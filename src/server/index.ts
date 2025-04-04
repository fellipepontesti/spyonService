import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"
import { RoomDTO } from "@src/domain/dto/roomDTO"
import { Funcao, PlayerDTO } from "@src/domain/dto/playerDTO"
import IniciarJogo from "@src/domain/usecases/IniciarJogo"
import { CriarSalaDTO } from "@src/domain/dto/criarSalaDTO"
import { EntrarSalaDTO } from "@src/domain/dto/entrarSalaDTO"
import { sortearSalasAleatorias } from "@src/helpers/sortearSalas"

const app = express()
const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: "*",
  },
})

export const salas: RoomDTO = {}

io.on("connection", (socket) => {
  socket.on("criarSala", (data: CriarSalaDTO) => {
    const codigo = gerarCodigo()
    socket.join(codigo)
    if (!salas[codigo]) {
      salas[codigo] = {
        privada: data.password ? true : false,
        password: data.password ? data.password : '',
        codigo: codigo,
        socketIdOwner: socket.id,
        quantidadeDeVotacoes: 0,
        players: [{
          socketId: socket.id,
          name: data.nomeJogador,
          wins: 0,
          funcao: Funcao.EQUIPE
        }]
      }
    }

    const { password, ...salaSemSenha } = salas[codigo]

    io.to(codigo).emit("redirecionarParaSala", salaSemSenha)
    io.to(codigo).emit("atualizarSala", salaSemSenha)
  })

  socket.on("listarSalas", () => {
    const result = sortearSalasAleatorias(salas)
    
    socket.emit("listaDeSalas", result)
    return
  })

  socket.on("entrarSala", (data: EntrarSalaDTO) => {
    const sala = salas[data.codigo]
    if (!sala) {
      socket.emit("erro", "Sala não encontrada")
      return
    }

    if (sala.privada && !data.password) {
      socket.emit("salaPrivada", sala.codigo)
      return
    }

    if (sala.players.length < 20) {
      if (sala.password && sala.password !== data.password) {
        socket.emit("erro", "Senha incorreta")
      }

      const jogadorExiste = checarJogadorExistente(socket.id, sala.players)
      if (jogadorExiste) {
        socket.emit("erro", "Jogador já está presente na sala")
        return
      }

      if (sala.privada && data.password !== sala.password) {
        socket.emit("erro", "Senha incorreta")
        return
      }

      socket.join(data.codigo)
      sala.players.push({
        socketId: socket.id,
        name: data.nomeJogador,
        wins: data.wins,
        funcao: Funcao.EQUIPE
      })

      const { password, ...salaSemSenha } = sala
      io.emit("salaEncontrada", salaSemSenha)
      io.to(data.codigo).emit("atualizarSala", salaSemSenha)
    } else {
      socket.emit("erro", "Sala cheia ou inexistente")
    }
  })

  socket.on("mensagem", ({ codigo, mensagem }: { codigo: string, mensagem: string }) => {
    io.to(codigo).emit("novaMensagem", { jogador: socket.id, mensagem })
  })

  socket.on("sairDaSala", (codigo: string) => {
    const sala = salas[codigo]
    if (sala.players.length) { 
      sala.players = sala.players?.filter(player => player.socketId !== socket.id)
    }

    if (sala.players.length === 0) {
      delete salas[codigo]
    } else {
      salas[codigo].socketIdOwner = salas[codigo].players[0].socketId
      io.to(codigo).emit("atualizarSala", sala)
    }
  })

  socket.on("iniciarJogo", (codigo: string) => {
    salas[codigo] = new IniciarJogo(socket, salas[codigo]).call()

    const { password, ...salaSemSenha } = salas[codigo]

    io.to(codigo).emit("jogoIniciado", salaSemSenha)
  })

  socket.on("abrirVotacao", (codigo: string) => {
    socket.broadcast.to(codigo).emit("aceitarVotacao")
  })
})

server.listen(3000, () => {
  console.log("Servidor WebSocket rodando na porta 3000")
});

function gerarCodigo() {
  let novoCodigo = false
  let codigo = ''

  while (!novoCodigo) {

    const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    
    for (let i = 0; i < 6; i++) {
      const indice = Math.floor(Math.random() * letras.length)
      codigo += letras[indice]
    }

    if (!salas[codigo]) {
      novoCodigo = true
    }
  }

  return codigo
}

function checarJogadorExistente(socketId: string, players: PlayerDTO[]): boolean {
    return players.some(player => player.socketId === socketId)
}