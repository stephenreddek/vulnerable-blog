import Database from 'bun:sqlite'

export type Post = {
   user_id: number
   post_id: number
   username: string
   contents: string
}

export type PostCreate = {
   user_id: number
   contents: string
}

export type PostUpdate = {
   post_id: number
   contents: string
}

export class PostService {
   constructor(private db: Database) {}

   public create(post: PostCreate): void {
      this.db.query(`INSERT INTO posts (user_id, contents) VALUES ($user_id, $contents);`).run({
         $user_id: post.user_id,
         $contents: post.contents,
      })
   }

   public update(post: PostUpdate): void {
      this.db.query(`UPDATE posts set contents = $contents WHERE rowid = $post_id;`).run({
         $post_id: post.post_id,
         $contents: post.contents,
      })
   }

   public fetch(post_id: number): Post | null {
      const post = this.db
         .query(
            'SELECT posts.rowid as post_id, user_id, contents, users.username FROM posts INNER JOIN users ON users.rowid = posts.user_id WHERE posts.rowid = $post_id'
         )
         .get({ $post_id: post_id })

      return post as Post
   }

   public fetchByUser(user_id: number): Post[] {
      const posts = this.db
         .query(
            'SELECT posts.rowid as post_id, user_id, contents, users.username FROM posts INNER JOIN users ON users.rowid = posts.user_id WHERE user_id = $user_id'
         )
         .all({ $user_id: user_id })

      return posts as Post[]
   }

   public retrieve(): Post[] {
      const posts = this.db
         .query('SELECT posts.rowid as post_id, user_id, contents, users.username FROM posts INNER JOIN users ON users.rowid = posts.user_id')
         .all()

      return posts as Post[]
   }
}
