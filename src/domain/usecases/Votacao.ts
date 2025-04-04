import { DefaultEventsMap, Socket } from "socket.io"
import { RoomDataDTO } from "@src/domain/dto/roomDTO"
import { Funcao } from "../dto/playerDTO"
import { LugaresDTO } from "../dto/lugares/LugaresDTO"
import { sortearLocal } from "@src/helpers/sortearLugar"

export default class Votacao {
  constructor (
    private socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    private sala: RoomDataDTO
  ) { }

  call (): RoomDataDTO {
    this.socket.emit("erro", "Não foi possível iniciar o jogo")
    return this.sala

    // this.sortearImpostorAndFirstPlayer()
    return this.sala
  }

  private validacoes () {
    
  }
}