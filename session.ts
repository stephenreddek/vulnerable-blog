import Database from 'bun:sqlite'

export class SessionStore<T = any> {
   constructor(private db: Database, public cookie_name: string) {}

   public init() {
      this.db.query(`CREATE TABLE sessions (key text, value text);`).run()
   }

   public createSession(data: T, res: Response): void {
      const session_id = crypto.randomUUID()

      this.set(session_id, data)

      res.headers.append('Set-Cookie', `${this.cookie_name}=${session_id}; SameSite=None; Secure`)
   }

   public getSessionById(session_id: string): T | null {
      return this.get(session_id)
   }

   public getSessionFromCookie(request: Request): T | null {
      const session_id = this.findSessionId(request)

      if (session_id === null) {
         return null
      }

      return this.get(session_id)
   }

   public endSession(request: Request): void {
      const session_id = this.findSessionId(request)

      if (session_id === null) {
         return
      }

      this.remove(session_id)
   }

   private findSessionId(request: Request): string | null {
      const cookie_header = request.headers.get('Cookie')

      if (cookie_header === null) {
         return null
      }

      const cookies = cookie_header.split('; ')

      const session_cookie = cookies.find(cookie => {
         const [name, _value] = cookie.split('=')
         return name === this.cookie_name
      })

      if (session_cookie === undefined) {
         return null
      }

      const [_name, session_id] = session_cookie.split('=')

      if (session_id === undefined) {
         console.error('Malformed cookie', { cookie: session_cookie })
         return null
      }

      return session_id
   }

   private set(key: string, value: T): void {
      this.db
         .query(`INSERT INTO sessions (key, value) VALUES ($key, $value) ON CONFLICT DO UPDATE SET value = $value`)
         .run({ $key: key, $value: JSON.stringify(value) })
   }

   private get(key: string): T | null {
      const result = this.db.query(`SELECT value FROM sessions WHERE key = $key`).get({ $key: key })
      if (result === null) {
         return null
      }

      return JSON.parse((result as any).value)
   }

   private remove(key: string) {
      this.db.query(`DELETE FROM sessions WHERE key = $key`).run({ $key: key })
   }
}
