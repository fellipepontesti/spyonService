import { RoomDataDTO, RoomDTO } from "@src/domain/dto/roomDTO";

export function listagemDeSalas(
  salas: RoomDTO,
  page: number = 1,
  limit: number = 12
): RoomDataDTO[] {
  const chaves = Object.keys(salas)
  const salasOrdenadas = chaves
    .map(chave => salas[chave])
    .filter(sala => !sala.jogoIniciado)

  const inicio = (page - 1) * limit
  const fim = inicio + limit

  return salasOrdenadas.slice(inicio, fim)
}