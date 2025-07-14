import { RoomDataDTO } from "../../domain/dto/roomDTO"
import { Funcao } from "../dto/playerDTO"
import { sortearLocal } from "../../helpers/sortearLugar"
import { SocketClient, SocketServer } from "../../server"

export default class IniciarJogo {
  constructor (
    private socket: SocketClient,
    private io: SocketServer,
    private sala: RoomDataDTO
  ) { }

  call () {
    const erro = this.validacoes()

    this.sala.jogoIniciado = true

    if (erro) {
      this.socket.emit("erro", "Não foi possível iniciar o jogo")
    }

    this.sala.salaResetada = false
    this.sortearImpostorAndFirstPlayer()
    const { password, ...salaSemSenha } = this.sala
    this.io.to(this.sala.codigo).emit("jogoIniciado", salaSemSenha)
  }

  private validacoes (): boolean {
    if (this.sala.socketIdOwner !== this.socket.id) {
      return true
    }

    if (this.sala.players.length < 3) {
      return true
    }

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
    this.sala.players[beginPlayerIndex].inicia = true
  }
}