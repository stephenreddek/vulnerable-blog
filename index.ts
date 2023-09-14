import { Database } from 'bun:sqlite'
import * as Seed from './seed'
import { SessionStore } from './session'
import { User, UserService } from './UserService'
import { Post, PostService } from './PostService'

const app_db = new Database('dev.sqlite')
const session_db = new Database(':memory:')

const user_service = new UserService(app_db)
const post_service = new PostService(app_db)

type SessionData = {
   user: User
}

const session_store = new SessionStore<SessionData>(session_db, 'OWASP')

session_store.init()

if (!Seed.isSeeded(app_db)) {
   Seed.seedTestData(app_db)
}

async function serveWithTemplatedHtml<Template extends Record<string, string>>(file_path: string, data: Template): Promise<Response> {
   const profile_html_template = await Bun.file(file_path).text()
   let templated = profile_html_template

   for (const key in data) {
      const value = data[key]
      templated = templated.replaceAll(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), value)
   }

   return new Response(templated, {
      headers: { 'Content-Type': 'text/html;charset=utf-8' },
   })
}

function maybeAdminLink(user: User | null | undefined): Record<string, string> {
   return { maybe_admin_link: user?.role === 'admin' ? `<a href="/admin">Admin</a>` : '' }
}

function loginOrProfile(user: User | null | undefined): Record<string, string> {
   return {
      login_or_profile:
         user === null || user === undefined
            ? `<a href="/login">Login</a>`
            : `<a href="/users/${user?.user_id}">Profile</a> <a href="/logout">Logout</a>`,
   }
}

function userToTemplateValues(user: User): Record<string, string> {
   return {
      username: user.username,
      user_id: user.user_id.toString(),
      role: user.role,
   }
}

function formatPosts(posts: Post[], user: User | null | undefined): Record<string, string> {
   const maybeEditButton = (post: Post) => {
      if (user === null || user === undefined) {
         return ''
      }

      if (post.user_id !== user.user_id) {
         return ''
      }

      return `<a href="/posts/${post.post_id}">Edit</a>`
   }

   return {
      blog_posts: posts
         .map(post => {
            return `<p>${post.contents}</p>${maybeEditButton(post)}<h3>by ${post.username}</h3>`
         })
         .join(`<br />`),
   }
}

Bun.serve({
   async fetch(req) {
      const url = new URL(req.url)
      if (url.pathname === '/') {
         const session = session_store.getSessionFromCookie(req)

         return serveWithTemplatedHtml('./pages/index.html', { ...loginOrProfile(session?.user), ...maybeAdminLink(session?.user) })
      }
      if (url.pathname === '/blog') {
         const session = session_store.getSessionFromCookie(req)
         const posts = post_service.retrieve()

         return serveWithTemplatedHtml('./pages/blog.html', {
            ...loginOrProfile(session?.user),
            ...maybeAdminLink(session?.user),
            ...formatPosts(posts, session?.user),
         })
      }
      if (url.pathname === '/admin') {
         const session = session_store.getSessionFromCookie(req)

         if (session === null) {
            return new Response('Not authenticated')
         }

         return serveWithTemplatedHtml('./pages/admin.html', {
            ...userToTemplateValues(session.user),
            ...maybeAdminLink(session.user),
            ...loginOrProfile(session.user),
         })
      }
      if (url.pathname === '/login' && req.method === 'GET') return serveWithTemplatedHtml('./pages/login.html', { ...loginOrProfile(null) })
      if (url.pathname === '/login' && req.method === 'POST') {
         const body = await req.formData()

         const username = body.get('username')
         const password = body.get('password')

         if (username === null || password === null) {
            return Response.error()
         }

         const user = user_service.fetchByUserName(username.toString())

         if (user === undefined || user === null) {
            return new Response('invalid username')
         }

         const is_valid = await Bun.password.verify(password.toString(), (<any>user).password_hash)
         if (!is_valid) {
            return Response.redirect('/login')
         }

         const response = Response.redirect(`/users/${user.user_id}`)

         session_store.createSession({ user }, response)

         return response
      }
      if (url.pathname === '/logout') {
         session_store.endSession(req)

         return Response.redirect('/')
      }
      if (url.pathname.startsWith('/users/')) {
         const user_param = url.pathname.substring('/users/'.length)
         const user_id = parseInt(user_param, 10)

         if (Number.isNaN(user_id)) {
            return new Response('Invalid user id')
         }

         const session = session_store.getSessionFromCookie(req)

         if (session === null) {
            return new Response('Not authenticated')
         }

         if (user_id !== session.user.user_id) {
            return new Response(`Cannot access another user's profile!`)
         }

         return serveWithTemplatedHtml('./pages/profile.html', {
            ...userToTemplateValues(session.user),
            ...maybeAdminLink(session.user),
            ...loginOrProfile(session.user),
         })
      }
      if (url.pathname === '/posts' && req.method === 'POST') {
         const body = await req.formData()

         const blog_post = body.get('blog_post')
         const user_id = body.get('user_id')

         if (blog_post === null || user_id === null) {
            return Response.error()
         }

         post_service.create({ user_id: parseInt(user_id.toString(), 10), contents: blog_post.toString() })

         return Response.redirect(`/blog`)
      }
      if (url.pathname.startsWith('/posts/') && req.method === 'GET') {
         const post_id_param = url.pathname.substring('/posts/'.length)
         const post_id = parseInt(post_id_param, 10)

         if (Number.isNaN(post_id)) {
            return new Response('Invalid post id')
         }

         const session = session_store.getSessionFromCookie(req)

         if (session === null) {
            return new Response('Not authenticated')
         }

         const post = post_service.fetch(post_id)

         if (post === null) {
            return new Response('Post does not exist')
         }

         return serveWithTemplatedHtml('./pages/post_edit.html', {
            ...userToTemplateValues(session.user),
            ...maybeAdminLink(session.user),
            ...loginOrProfile(session.user),
            post_id: post.post_id.toString(),
            post_contents: post.contents,
         })
      }
      if (url.pathname.startsWith('/posts/') && req.method === 'POST') {
         const post_id_param = url.pathname.substring('/posts/'.length)
         const post_id = parseInt(post_id_param, 10)

         if (Number.isNaN(post_id)) {
            return new Response('Invalid post id')
         }

         const body = await req.formData()

         const blog_post = body.get('blog_post')

         if (blog_post === null) {
            return Response.error()
         }

         post_service.update({ post_id: post_id, contents: blog_post.toString() })

         return Response.redirect(`/blog`)
      }
      return new Response('404!')
   },
   error(error) {
      return new Response(`<pre>${error}\n${error.stack}</pre>`, {
         headers: {
            'Content-Type': 'text/html',
         },
      })
   },
})
