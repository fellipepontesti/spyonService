import { PlayerDTO } from "@spyonService/domain/dto/playerDTO"

export interface CriarSalaDTO {
  player: PlayerDTO
  password?: string
}