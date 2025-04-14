import { RoomDataDTO, RoomDTO } from "@src/domain/dto/roomDTO";

export function sortearSalasAleatorias(salas: RoomDTO): RoomDataDTO[] {
  const chaves = Object.keys(salas)
  const salasAleatorias = chaves
    .sort(() => Math.random() - 0.5)
    .slice(0, 10)
    .map(chave => salas[chave])
    .filter(sala => !sala.jogoIniciado)

  return salasAleatorias;
}