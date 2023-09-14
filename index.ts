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

function loginOrLogout(user: User | null | undefined): Record<string, string> {
   return {
      login_or_logout: user === null || user === undefined ? `<a href="/login">Login</a>` : `<a href="/logout">Logout</a>`,
   }
}

function formatPosts(posts: Post[]): Record<string, string> {
   return {
      blog_posts: posts
         .map(post => {
            return `<p>${post.contents}</p><h3>by ${post.username}</h3>`
         })
         .join(`<br />`),
   }
}

Bun.serve({
   async fetch(req) {
      const url = new URL(req.url)
      if (url.pathname === '/') {
         const session = session_store.getSessionFromCookie(req)

         return serveWithTemplatedHtml('./pages/index.html', { ...loginOrLogout(session?.user) })
      }
      if (url.pathname === '/blog') {
         const session = session_store.getSessionFromCookie(req)
         const posts = post_service.retrieve()

         return serveWithTemplatedHtml('./pages/blog.html', { ...loginOrLogout(session?.user), ...formatPosts(posts) })
      }
      if (url.pathname === '/login' && req.method === 'GET') return serveWithTemplatedHtml('./pages/login.html', {})
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

         const response = Response.redirect(`/blog`)

         session_store.createSession({ user }, response)

         return response
      }
      if (url.pathname === '/logout') {
         session_store.endSession(req)

         return Response.redirect('/')
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
