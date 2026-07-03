import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne } from "typeorm"
import { UserPoints } from "./UserPoints"

@Entity("users")
export class User {
  @PrimaryColumn({ length: 128 })
  id!: string // UID do Firebase

  @Column({ length: 255 })
  email!: string

  @Column({ length: 50 })
  username!: string

  @Column({ name: "quantidade_de_logins", default: 0 })
  quantidadeLogins!: number

  @Column({ name: "quantidade_de_partidas", default: 0 })
  quantidadePartidas!: number

  @OneToOne(() => UserPoints, (points) => points.user, { cascade: true })
  points!: UserPoints

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date
}
