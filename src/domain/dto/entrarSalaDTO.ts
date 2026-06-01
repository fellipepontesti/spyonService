import { PlayerDTO } from "@spyonService/domain/dto/playerDTO"

export interface EntrarSalaDTO {
  codigo: string
  player: PlayerDTO
  password?: string
  owner?: boolean
}