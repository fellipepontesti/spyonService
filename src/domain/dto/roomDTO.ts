import { PlayerDTO } from "@src/domain/dto/playerDTO"

export interface RoomDTO {
  [key: string]: RoomDataDTO
}

export interface RoomDataDTO {
  privada: boolean
  password?: string
  codigo: string
  socketIdOwner: string
  players: PlayerDTO[]
  quantidadeDeVotacoes: number
  lugar?: number
}