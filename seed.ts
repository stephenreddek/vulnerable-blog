import { Database } from 'bun:sqlite'
import { UserCreate, UserService } from './UserService'
import { PostService } from './PostService'

export function isSeeded(db: Database): boolean {
   try {
      return db.query(`SELECT * FROM users;`).get() !== undefined
   } catch {
      return false
   }
}

export function seedTestData(db: Database): void {
   const users: UserCreate[] = [
      { username: 'admin', password: 'admin', role: 'admin' },
      { username: 'stephen', password: 'stephen', role: 'user' },
      { username: 'justin', password: 'justin', role: 'user' },
      { username: 'drake', password: 'drake', role: 'user' },
   ]

   db.query(`create table users (username text, password_hash text, role text);`).run()
   db.query(`create table posts (user_id integer, contents text);`).run()

   const user_service = new UserService(db)

   for (const user of users) {
      user_service.create(user)
   }

   const post_service = new PostService(db)

   post_service.create({ user_id: 1, contents: 'Example Post' })
}
