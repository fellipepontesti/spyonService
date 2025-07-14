import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"
import { RoomDataDTO, RoomDTO, VoltarPraSalaDTO } from "@src/domain/dto/roomDTO"
import { Funcao, PlayerDTO } from "@src/domain/dto/playerDTO"
import IniciarJogo from "@src/domain/usecases/IniciarJogo"
import { CriarSalaDTO } from "@src/domain/dto/criarSalaDTO"
import { EntrarSalaDTO } from "@src/domain/dto/entrarSalaDTO"
import { listagemDeSalas } from "@src/helpers/sortearSalas"
import { ConfirmarVotoDTO, DiscussaoDTO } from '@src/domain/dto/votacaoDTO';
import { DefaultEventsMap, Server as IOServer, Socket as IOSocket } from "socket.io"

export type SocketServer = IOServer<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>
export type SocketClient = IOSocket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>

const app = express()
const server = createServer(app)
const io = new Server(server, {
  cors: { origin: "*" },
})

export const salas: RoomDTO = {}

app.get('/health-check', (req, res) => {
  res.sendStatus(204).json({
    message: "it's ok!"
  })
})

function comSalaValida(codigo: string, callback: (sala: typeof salas[string]) => void, socket: any) {
  const sala = salas[codigo]
  if (!sala || !sala.players || sala.players.length === 0) {
    socket.emit("erro", "Sala inexistente ou vazia")
    return
  }
  callback(sala)
}

io.on("connection", (socket) => {
  socket.on("criarSala", (data: CriarSalaDTO) => {
    const codigo = gerarCodigo()
    socket.join(codigo)

    salas[codigo] = {
      jogoIniciado: false,
      privada: !!data.password,
      password: data.password ?? '',
      codigo,
      tentativas: 0,
      socketIdOwner: socket.id,
      quantidadeDeVotacoes: 3,
      players: [{
        socketId: socket.id,
        nome: data.player.nome,
        vitorias: data.player.vitorias
      }],
      votosContabilizados: []
    }

    const { password, ...salaSemSenha } = salas[codigo]
    io.to(codigo).emit("redirecionarParaSala", salaSemSenha)
    io.to(codigo).emit("atualizarSala", salaSemSenha)
    io.emit("novaSalaCriada", salaSemSenha)
  })

  socket.on("listarSalas", (data) => {
    const result = listagemDeSalas(salas, data?.page || 1)
    socket.emit("listaDeSalas", result)
  })

  socket.on("entrarSala", (data: EntrarSalaDTO) => {
    const sala = salas[data.codigo]

    if (!sala) {
      socket.emit("erro", "Sala não encontrada")
      return
    }

    if (sala.jogoIniciado) {
      socket.emit("erro", "O jogo já começou")
    }

    if (!sala.players || sala.players.length === 0) {
      sala.players = []
      sala.socketIdOwner = socket.id
    }

    if (sala.privada && !data.password) {
      socket.emit("salaPrivada", sala.codigo)
      return
    }

    if (sala.players.length < 20) {
      if (checarJogadorExistente(socket.id, sala.players)) {
        socket.emit("erro", "Jogador já está presente na sala")
        return
      }

      if (sala.privada && data.password !== sala.password) {
        socket.emit("erro", "Senha incorreta")
        return
      }

      if (data.owner) {
        sala.socketIdOwner = socket.id
      }

      socket.join(data.codigo)
      sala.players.push({
        socketId: socket.id,
        nome: data.player.nome,
        vitorias: data.player.vitorias
      })

      const { password, ...salaSemSenha } = sala
      socket.emit("salaEncontrada", salaSemSenha)
      io.to(data.codigo).emit("atualizarSala", salaSemSenha)
    } else {
      socket.emit("erro", "Sala cheia ou inexistente")
    }
  })

  socket.on("confirmarVoto", (data: ConfirmarVotoDTO) => {
    comSalaValida(data.codigo, (sala) => {
      const jaVotou = sala.votosContabilizados.find(v => v.socketPlayer === socket.id)
  
      if (!jaVotou) {
        sala.votosContabilizados.push({
          socketPlayer: socket.id,
          socketAlvo: data?.socketAlvo || undefined,
          skip: data.skip || false
        })
      }
  
      socket.emit("aguardandoResultado")
  
      const totalVotos = sala.votosContabilizados.length
      const totalPlayers = sala.players.length
  
      if (totalVotos === totalPlayers) {
        const votosValidos = sala.votosContabilizados.filter(v => v.socketAlvo && !v.skip)
        const votosSkip = sala.votosContabilizados.filter(v => v.skip)
  
        const maioriaSkip = votosSkip.length > totalPlayers / 2
        const votosNoEspiao = votosValidos.filter(v => {
          const jogadorAlvo = sala.players.find(p => p.socketId === v.socketAlvo)
          return jogadorAlvo?.funcao === Funcao.ESPIAO
        })
  
        const maioriaContraEspiao = votosNoEspiao.length > votosValidos.length / 2
  
        if (maioriaSkip) {
          resetarVotacao(sala)
  
          const fim = checarFimDeJogo(sala)
          if (fim) {
            io.to(data.codigo).emit("fimDeJogo", { vencedor: "espião" })
            return
          }
  
          io.to(data.codigo).emit("skip")
          io.to(data.codigo).emit("atualizarSala", sala)
          return
        }
  
        if (maioriaContraEspiao) {
          votosNoEspiao.forEach(voto => {
            io.to(voto.socketPlayer).emit("pontoGanho")
          })
  
          sala.jogoIniciado = false
          io.to(data.codigo).emit("fimDeJogo", { vencedor: "equipe" })
        } else {
          resetarVotacao(sala)
  
          const fim = checarFimDeJogo(sala)
          if (fim) {
            sala.players.forEach(player => {
              if (player.funcao === Funcao.ESPIAO) {
                io.to(player.socketId).emit("pontoGanho")
              }
            })
  
            io.to(data.codigo).emit("fimDeJogo", { vencedor: "espião" })
            return
          }
  
          io.to(data.codigo).emit("jogoContinua")
          io.to(data.codigo).emit("atualizarSala", sala)
        }
  
        sala.votosContabilizados = []
      }
    }, socket)
  })

  socket.on("mensagem", ({ codigo, mensagem }: { codigo: string, mensagem: string }) => {
    comSalaValida(codigo, () => {
      io.to(codigo).emit("novaMensagem", { jogador: socket.id, mensagem })
    }, socket)
  })

  socket.on("sairDaSala", (codigo: string) => {
    const sala = salas[codigo]
    if (!sala) return

    sala.players = sala.players.filter(p => p.socketId !== socket.id)

    if (sala.players.length === 0) {
      delete salas[codigo]
      io.emit("salaRemovida", codigo)
    } else {
      sala.socketIdOwner = sala.players[0].socketId
      io.to(codigo).emit("atualizarSala", sala)
    }
  })

  socket.on("iniciarJogo", (codigo: string) => {
    comSalaValida(codigo, (sala) => {
      new IniciarJogo(socket, io, sala).call()
    }, socket)
  })

  socket.on("pedirDiscussao", (codigo: string) => {
    comSalaValida(codigo, (sala) => {
      sala.players.forEach(p => {
        if (p.socketId === socket.id) {
          p.aceitarDiscussao = true
        }
      })
    }, socket)
    socket.broadcast.to(codigo).emit("novaSolicitacaoDiscussao")
  })

  socket.on("votarNaDiscussao", (data: DiscussaoDTO) => {
    comSalaValida(data.codigo, (sala) => {
      sala.players.forEach(p => {
        if (p.socketId === socket.id) {
          p.aceitarDiscussao = data.discussao
        }
      })

      const todosVotaramNaDiscussao = sala.players.every(p => p.aceitarDiscussao !== undefined)

      if (todosVotaramNaDiscussao) {
        const media = sala.players.length / 2
        const votosAceitos = sala.players.filter(player => player.aceitarDiscussao)

        if (votosAceitos.length >= media) {
          io.to(sala.codigo).emit("mudarParaVotacao")
        } else {
          io.to(sala.codigo).emit("message", "A pedido de votação foi negado pela maioria")
        }

        resetarDiscussao(sala)
      } 
    }, socket)
  })

  socket.on('voltarParaSala', (input: VoltarPraSalaDTO) => {
    const sala = salas[input.codigo]

    if (!sala) return

    if (sala.socketIdOwner === socket.id) {
      sala.players = []
      
      socket.emit('voltarOwner')
      const { password, ...salaSemSenha } = sala
      io.to(input.codigo).emit("atualizarSala", salaSemSenha)
      io.to(input.codigo).emit('salaLiberada')
    } else {
      socket.emit('aguardandoOwner')
    }
  })
})

server.listen(3000, () => {
  console.log("Servidor WebSocket rodando na porta 3000")
})

function gerarCodigo(): string {
  const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  let codigo = ""
  let novoCodigo = false

  while (!novoCodigo) {
    codigo = Array.from({ length: 6 }, () => letras[Math.floor(Math.random() * letras.length)]).join("")
    if (!salas[codigo]) novoCodigo = true
  }

  return codigo
}

function checarJogadorExistente(socketId: string, players: PlayerDTO[]): boolean {
  return players.some(p => p.socketId === socketId)
}

function resetarDiscussao(sala: RoomDataDTO) {
  sala.players.forEach(p => {
    p.aceitarDiscussao = undefined
  })
}

function resetarVotacao(sala: RoomDataDTO) {
  sala.votacaoEmAndamento = false
  sala.tentativas++
  sala.votosContabilizados = []
}

function resetarSala(sala: RoomDataDTO) {
  sala.players = []
  sala.lugar = undefined
  sala.tentativas = 0
  sala.votacaoEmAndamento = false
  sala.votosContabilizados = []
  sala.salaResetada = true
}

function checarFimDeJogo(sala: RoomDataDTO) {
  if (sala.tentativas === sala.quantidadeDeVotacoes) {
    return true
  }

  return false
}