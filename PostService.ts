import Database from 'bun:sqlite'

export type Post = {
   user_id: string
   username: string
   contents: string
}

export type PostCreate = {
   user_id: string
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

   public fetchByUser(user_id: string | number): Post[] {
      const posts = this.db
         .query(
            'SELECT posts.rowid as post_id, user_id, contents, users.username FROM posts INNER JOIN users ON users.rowid = posts.user_id WHERE user_id = $user_id'
         )
         .all({ $user_id: user_id.toString() })

      return posts as Post[]
   }

   public retrieve(): Post[] {
      const posts = this.db
         .query('SELECT posts.rowid as post_id, user_id, contents, users.username FROM posts INNER JOIN users ON users.rowid = posts.user_id')
         .all()

      return posts as Post[]
   }
}
