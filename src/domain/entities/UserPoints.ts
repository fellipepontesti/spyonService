import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn } from "typeorm"
import { User } from "./User"

@Entity("user_points")
export class UserPoints {
  @PrimaryColumn({ name: "user_id", length: 128 })
  userId!: string

  @Column({ name: "vitorias_impostor", default: 0 })
  vitoriasImpostor!: number

  @Column({ name: "vitorias_comuns", default: 0 })
  vitoriasComuns!: number

  @OneToOne(() => User, (user) => user.points, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User
}
