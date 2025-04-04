import { DefaultEventsMap, Socket } from "socket.io"
import { RoomDataDTO } from "@src/domain/dto/roomDTO"
import { Funcao } from "../dto/playerDTO"
import { LugaresDTO } from "../dto/lugares/LugaresDTO"
import { sortearLocal } from "@src/helpers/sortearLugar"

export default class IniciarJogo {
  constructor (
    private socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    private sala: RoomDataDTO
  ) { }

  call (): RoomDataDTO {
    const erro = this.validacoes()

    if (erro) {
      this.socket.emit("erro", "Não foi possível iniciar o jogo")
      return this.sala
    }

    this.sortearImpostorAndFirstPlayer()
    return this.sala
  }

  private validacoes (): boolean {
    if (this.sala.socketIdOwner !== this.socket.id) {
      return true
    }

    // if (this.sala.players.length < 3) {
    //   return true
    // }

    return false
  }

  private sortearImpostorAndFirstPlayer () {
    const lugar = sortearLocal()
    const index = Math.floor(Math.random() * this.sala.players.length)
    const beginPlayerIndex = Math.floor(Math.random() * this.sala.players.length)
    this.sala.players.forEach(player => {
      player.lugar = lugar
    })
    this.sala.players[index].funcao = Funcao.ESPIAO
    this.sala.players[index].lugar = undefined
    this.sala.players[beginPlayerIndex].begin = true
  }
}