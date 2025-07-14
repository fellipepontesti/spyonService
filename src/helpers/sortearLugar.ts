import { LugaresDTO } from "../domain/dto/lugares/LugaresDTO"

export function sortearLocal(): LugaresDTO {
  const valores = Object.values(LugaresDTO).filter(value => typeof value === "number") as number[]
  const indiceSorteado = Math.floor(Math.random() * valores.length)
  return valores[indiceSorteado] as LugaresDTO
}