import Database from 'bun:sqlite'

export type User = {
   user_id: number
   username: string
   password_hash: string
   role: Role
}

export type UserCreate = {
   username: string
   password: string
   role: Role
}

export type Role = 'user' | 'admin'

export class UserService {
   constructor(private db: Database) {}

   public create(user: UserCreate): User | null {
      this.db.query(`INSERT INTO users (username, password_hash, role) VALUES ($username, $hash, $role) RETURNING username;`).run({
         $username: user.username,
         $hash: Bun.password.hashSync(user.password),
         $role: user.role,
      })

      return this.fetchByUserName(user.username)
   }

   public fetchById(user_id: number): User | null {
      const user = this.db
         .query('SELECT username, password_hash, rowid as user_id, role FROM users WHERE rowid = $user_id')
         .get({ $user_id: user_id.toString() })

      return (user as User) ?? null
   }

   public fetchByUserName(username: string): User | null {
      const user = this.db
         .query('SELECT username, password_hash, rowid as user_id, role FROM users WHERE username = $username')
         .get({ $username: username.toString() })

      return (user as User) ?? null
   }

   public retrieve(): User[] {
      const users = this.db.query('SELECT username, password_hash, rowid as user_id, role FROM users').all()

      return users as User[]
   }
}
