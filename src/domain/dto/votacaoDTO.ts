export interface DiscussaoDTO {
  codigo: string
  discussao: boolean
}

export interface ConfirmarVotoDTO {
  codigo: string
  socketAlvo?: string
  socketAcusador: string
  skip?: boolean
}