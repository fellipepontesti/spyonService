import fs from "fs"
import path from "path"
import { RoomDTO } from "@spyonService/domain/dto/roomDTO"

const FILE_PATH = path.join(__dirname, "../../../salas.json")

export function salvarSalas(salas: RoomDTO) {
  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify(salas, null, 2), "utf-8")
  } catch (error) {
    console.error("[Persistência] Erro ao salvar salas no JSON:", error)
  }
}

export function carregarSalas(): RoomDTO {
  try {
    if (fs.existsSync(FILE_PATH)) {
      const data = fs.readFileSync(FILE_PATH, "utf-8")
      const salasObj = JSON.parse(data)
      console.log(`[Persistência] ${Object.keys(salasObj).length} salas carregadas com sucesso!`)
      return salasObj
    }
  } catch (error) {
    console.error("[Persistência] Erro ao carregar salas do JSON:", error)
  }
  return {}
}
