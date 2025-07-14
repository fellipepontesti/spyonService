import { LugaresDTO } from "../../domain/dto/lugares/LugaresDTO"

export interface PlayerDTO {
  nome: string
  socketId: string
  vitorias: number
  funcao?: Funcao
  lugar?: LugaresDTO
  inicia?: boolean
  aceitarDiscussao?: boolean
}

export enum Funcao {
  ESPIAO = 0,
  EQUIPE = 1
}