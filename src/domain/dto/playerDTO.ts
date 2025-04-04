import { LugaresDTO } from "@src/domain/dto/lugares/LugaresDTO"

export interface PlayerDTO {
  name: string
  socketId: string
  wins: number
  funcao: Funcao
  lugar?: LugaresDTO
  begin?: boolean
}

export enum Funcao {
  ESPIAO = 0,
  EQUIPE = 1
}