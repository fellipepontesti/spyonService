import { RoomDataDTO, RoomDTO } from "../domain/dto/roomDTO";

export interface ListarSalasOutputDTO {
  salas: RoomDataDTO[],
  count: number,
  page: number
}

export function listagemDeSalas(
  salas: RoomDTO,
  page: number = 1,
  limit: number = 12
): ListarSalasOutputDTO {
  const chaves = Object.keys(salas)
  const salasOrdenadas = chaves
    .map(chave => salas[chave])
    .filter(sala => !sala.jogoIniciado)

  const inicio = (page - 1) * limit
  const fim = inicio + limit

  return {
    salas: salasOrdenadas.slice(inicio, fim),
    count: salasOrdenadas.length,
    page: page
  }
}