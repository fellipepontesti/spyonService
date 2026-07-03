import { PlayerDTO } from "@spyonService/domain/dto/playerDTO"

export interface RoomDTO {
  [key: string]: RoomDataDTO
}

export interface TurnoDTO {
  perguntaPlayerId: string // player.id de quem pergunta
  respostaPlayerId: string | null // player.id de quem responde
  tempoRestante: number
  fase: 'selecionar-respondente' | 'em-andamento' | 'selecionar-perguntador'
}

export interface RoomDataDTO {
  jogoIniciado: boolean
  privada: boolean
  password?: string
  codigo: string
  ownerTemp?: string
  socketIdOwner: string
  players: PlayerDTO[]
  quantidadeDeVotacoes: number
  lugar?: number
  votacaoEmAndamento?: boolean
  tentativas: number
  votosContabilizados: VotosContabilizadosData[]
  salaResetada?: boolean
  turno?: TurnoDTO
  jogadoresPerguntaram?: string[]
  jogadoresResponderam?: string[]
}

export interface VotosContabilizadosData {
  socketPlayer: string
  socketAlvo?: string
  skip: boolean
}

export interface VoltarPraSalaDTO {
  player: PlayerDTO
  codigo: string
}