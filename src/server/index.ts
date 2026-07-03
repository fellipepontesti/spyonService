import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"
import { inicializarBanco, AppDataSource, incrementarVitoriasComuns, incrementarVitoriasImpostor } from "../helpers/database"
import { User } from "../domain/entities/User"
import { UserPoints } from "../domain/entities/UserPoints"

inicializarBanco()

import { RoomDataDTO, RoomDTO, VoltarPraSalaDTO } from "@spyonService/domain/dto/roomDTO"
import { Funcao, PlayerDTO } from "@spyonService/domain/dto/playerDTO"
import IniciarJogo from "@spyonService/domain/usecases/IniciarJogo"
import { CriarSalaDTO } from "@spyonService/domain/dto/criarSalaDTO"
import { EntrarSalaDTO } from "@spyonService/domain/dto/entrarSalaDTO"
import { listagemDeSalas } from "@spyonService/helpers/sortearSalas"
import { ConfirmarVotoDTO, DiscussaoDTO } from '@spyonService/domain/dto/votacaoDTO';
import { DefaultEventsMap, Server as IOServer, Socket as IOSocket } from "socket.io"
import { carregarSalas, salvarSalas } from "@spyonService/helpers/persistenciaSalas"

export type SocketServer = IOServer<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>
export type SocketClient = IOSocket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>

const app = express()
const server = createServer(app)
const io = new Server(server, {
  cors: { origin: "*" },
})

export const salas: RoomDTO = carregarSalas()

app.get('/health-check', (req, res) => {
  res.status(200).json({
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

const timersSalas: { [codigoSala: string]: NodeJS.Timeout } = {}

function pararTimerTurno(codigo: string) {
  if (timersSalas[codigo]) {
    clearInterval(timersSalas[codigo])
    delete timersSalas[codigo]
  }
}

function iniciarTimerTurno(codigo: string) {
  pararTimerTurno(codigo)

  timersSalas[codigo] = setInterval(() => {
    const sala = salas[codigo]
    if (!sala || !sala.turno || sala.turno.fase !== "em-andamento" || !sala.jogoIniciado) {
      pararTimerTurno(codigo)
      return
    }

    sala.turno.tempoRestante -= 1

    if (sala.turno.tempoRestante <= 0) {
      pararTimerTurno(codigo)
      executarFinalizacaoTurno(codigo)
    } else {
      io.to(codigo).emit("atualizarSala", sanitizarSala(sala))
    }
  }, 1000)
}

function executarFinalizacaoTurno(codigo: string) {
  const sala = salas[codigo]
  if (!sala || !sala.turno || sala.turno.fase !== "em-andamento") return

  const turno = sala.turno
  const perguntaId = turno.perguntaPlayerId
  const respostaId = turno.respostaPlayerId

  if (!sala.jogadoresPerguntaram) sala.jogadoresPerguntaram = []
  if (!sala.jogadoresResponderam) sala.jogadoresResponderam = []

  // Adiciona na lista de participações
  if (!sala.jogadoresPerguntaram.includes(perguntaId)) {
    sala.jogadoresPerguntaram.push(perguntaId)
  }
  if (respostaId && !sala.jogadoresResponderam.includes(respostaId)) {
    sala.jogadoresResponderam.push(respostaId)
  }

  // Verifica se todos já perguntaram e todos já responderam
  const totalPlayers = sala.players.length
  const todosPerguntaram = sala.jogadoresPerguntaram.length >= totalPlayers
  const todosResponderam = sala.jogadoresResponderam.length >= totalPlayers

  if (todosPerguntaram && todosResponderam) {
    // Fim da rodada! Reinicia as listas
    sala.jogadoresPerguntaram = []
    sala.jogadoresResponderam = []
    
    // Quem acabou de responder é o próximo a perguntar
    turno.perguntaPlayerId = respostaId || perguntaId
    turno.respostaPlayerId = null
    turno.fase = "selecionar-respondente"
    turno.tempoRestante = 60
  } else {
    // A rodada continua. O perguntador atual escolhe quem será o próximo a perguntar
    turno.fase = "selecionar-perguntador"
    turno.tempoRestante = 60
  }

  io.to(codigo).emit("atualizarSala", sanitizarSala(sala))
}

io.on("connection", (socket) => {
  socket.on("sincronizarUsuario", async (data: { id: string; email: string; nomeOriginal: string }, callback: any) => {
    try {
      const userRepository = AppDataSource.getRepository(User)
      let user = await userRepository.findOne({ where: { id: data.id }, relations: { points: true } })

      if (!user) {
        user = new User()
        user.id = data.id
        user.email = data.email
        user.username = data.nomeOriginal || data.email.split("@")[0] || ""
        user.quantidadeLogins = 1
        user.quantidadePartidas = 0

        const points = new UserPoints()
        points.userId = data.id
        points.vitoriasImpostor = 0
        points.vitoriasComuns = 0
        user.points = points

        await userRepository.save(user)
      } else {
        if (!user.points) {
          const points = new UserPoints()
          points.userId = user.id
          points.vitoriasImpostor = 0
          points.vitoriasComuns = 0
          user.points = points
        }
        user.quantidadeLogins += 1
        await userRepository.save(user)
      }

      callback({
        success: true,
        user: {
          id: user.id,
          nome: user.username,
          quantidadeLogins: user.quantidadeLogins,
          quantidadePartidas: user.quantidadePartidas,
          vitoriasImpostor: user.points?.vitoriasImpostor || 0,
          vitoriasComuns: user.points?.vitoriasComuns || 0
        }
      })
    } catch (e: any) {
      console.error("Erro ao sincronizar usuario no socket:", e)
      callback({ success: false, error: e.message })
    }
  })

  socket.on("atualizarNickname", async (data: { id: string; nickname: string }, callback: any) => {
    try {
      const userRepository = AppDataSource.getRepository(User)
      const user = await userRepository.findOne({ where: { id: data.id }, relations: { points: true } })

      if (!user) {
        callback({ success: false, error: "Usuário não encontrado" })
        return
      }

      user.username = data.nickname
      await userRepository.save(user)

      callback({
        success: true,
        user: {
          id: user.id,
          nome: user.username,
          quantidadeLogins: user.quantidadeLogins,
          quantidadePartidas: user.quantidadePartidas,
          vitoriasImpostor: user.points?.vitoriasImpostor || 0,
          vitoriasComuns: user.points?.vitoriasComuns || 0
        }
      })
    } catch (e: any) {
      console.error("Erro ao atualizar nickname no socket:", e)
      callback({ success: false, error: e.message })
    }
  })

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
        id: data.player.id,
        socketId: socket.id,
        nome: data.player.nome,
        vitorias: data.player.vitorias
      }],
      votosContabilizados: []
    }

    const salaSemSenha = sanitizarSala(salas[codigo])
    io.to(codigo).emit("redirecionarParaSala", salaSemSenha)
    io.to(codigo).emit("atualizarSala", salaSemSenha)
    io.emit("novaSalaCriada", salaSemSenha)
    salvarSalas(salas)
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

    if (sala.jogoIniciado && !(data.player.id && sala.players.some(p => p.id === data.player.id))) {
      socket.emit("erro", "O jogo já começou")
      return
    }

    if (!sala.players || sala.players.length === 0) {
      sala.players = []
      sala.socketIdOwner = socket.id
    }

    if (sala.privada && !data.password && !(data.player.id && sala.players.some(p => p.id === data.player.id))) {
      socket.emit("salaPrivada", sala.codigo)
      return
    }

    if (sala.players.length < 20) {
      // Reconexão inteligente
      const jogadorExistente = data.player.id ? sala.players.find(p => p.id === data.player.id) : null
      if (jogadorExistente) {
        jogadorExistente.socketId = socket.id
        jogadorExistente.nome = data.player.nome // Atualiza o nome se tiver mudado
        
        socket.join(data.codigo)
        if (data.owner || sala.socketIdOwner === data.player.socketId || sala.players[0]?.id === data.player.id) {
          sala.socketIdOwner = socket.id
        }
        
        const salaSemSenha = sanitizarSala(sala)
        socket.emit("salaEncontrada", salaSemSenha)
        io.to(data.codigo).emit("atualizarSala", salaSemSenha)
        salvarSalas(salas)
        return
      }

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
        id: data.player.id,
        socketId: socket.id,
        nome: data.player.nome,
        vitorias: data.player.vitorias
      })

      const salaSemSenha = sanitizarSala(sala)
      socket.emit("salaEncontrada", salaSemSenha)
      io.to(data.codigo).emit("atualizarSala", salaSemSenha)
      salvarSalas(salas)
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
          io.to(data.codigo).emit("atualizarSala", sanitizarSala(sala))
          return
        }
  
        if (maioriaContraEspiao) {
          const equipePlayerIds = sala.players.filter(p => p.funcao === Funcao.EQUIPE && p.id).map(p => p.id) as string[]
          incrementarVitoriasComuns(equipePlayerIds).catch(err => console.error("Erro ao incrementar vitorias comuns:", err))

          sala.players.forEach((p) => {
            if (p.funcao === Funcao.EQUIPE) {
              io.to(p.socketId).emit("pontoGanho")
            }
          })
  
          sala.jogoIniciado = false
          io.to(data.codigo).emit("fimDeJogo", { vencedor: "equipe" })
        } else {
          resetarVotacao(sala)
  
          const fim = checarFimDeJogo(sala)
          if (fim) {
            const espiaoPlayerIds = sala.players.filter(p => p.funcao === Funcao.ESPIAO && p.id).map(p => p.id) as string[]
            incrementarVitoriasImpostor(espiaoPlayerIds).catch(err => console.error("Erro ao incrementar vitorias impostor:", err))

            sala.players.forEach((player) => {
              if (player.funcao === Funcao.ESPIAO) {
                io.to(player.socketId).emit("pontoGanho")
              }
            })
  
            io.to(data.codigo).emit("fimDeJogo", { vencedor: "espião" })
            return
          }
  
          io.to(data.codigo).emit("jogoContinua")
          io.to(data.codigo).emit("atualizarSala", sanitizarSala(sala))

          if (sala.turno && sala.turno.fase === "em-andamento") {
            iniciarTimerTurno(sala.codigo)
          }
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

    let precisaResetarTurno = false
    const jogadorSaindo = sala.players.find(p => p.socketId === socket.id)
    
    if (sala.turno && sala.jogoIniciado && jogadorSaindo) {
      if (sala.turno.perguntaPlayerId === jogadorSaindo.id || sala.turno.respostaPlayerId === jogadorSaindo.id) {
        precisaResetarTurno = true
      }
    }

    sala.players = sala.players.filter(p => p.socketId !== socket.id)

    if (sala.players.length === 0) {
      delete salas[codigo]
      pararTimerTurno(codigo)
      io.emit("salaRemovida", codigo)
    } else {
      if (sala.socketIdOwner === socket.id) {
        sala.socketIdOwner = sala.players[0].socketId
      }

      if (precisaResetarTurno && sala.jogoIniciado && sala.turno) {
        pararTimerTurno(codigo)
        if (jogadorSaindo) {
          sala.jogadoresPerguntaram = sala.jogadoresPerguntaram?.filter(id => id !== jogadorSaindo.id)
          sala.jogadoresResponderam = sala.jogadoresResponderam?.filter(id => id !== jogadorSaindo.id)
        }
        
        const novoPerguntador = sala.players[0]
        sala.turno.perguntaPlayerId = novoPerguntador.id || novoPerguntador.socketId
        sala.turno.respostaPlayerId = null
        sala.turno.fase = "selecionar-respondente"
        sala.turno.tempoRestante = 60
      }

      io.to(codigo).emit("atualizarSala", sanitizarSala(sala))
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
      pararTimerTurno(codigo)
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
          pararTimerTurno(sala.codigo)
          io.to(sala.codigo).emit("mudarParaVotacao")
        } else {
          io.to(sala.codigo).emit("message", "A pedido de votação foi negado pela maioria")
          if (sala.turno && sala.turno.fase === "em-andamento") {
            iniciarTimerTurno(sala.codigo)
          }
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
      const salaSemSenha = sanitizarSala(sala)
      io.to(input.codigo).emit("atualizarSala", salaSemSenha)
      io.to(input.codigo).emit('salaLiberada')
    } else {
      socket.emit('aguardandoOwner')
    }
  })

  socket.on('healthCheck', () => {
    console.log('---> chegou aqui')
    socket.emit('healthCheckResult', {
      message: 'It\'s ok!'
    })
  })

  socket.on('testeConexao', (payload) => {
    console.log('[testeConexao] evento recebido da tela inicial', {
      socketId: socket.id,
      payload
    })

    socket.emit('testeConexaoResult', {
      message: 'Evento recebido no backend',
      socketId: socket.id,
      recebidoEm: new Date().toISOString()
    })
  })

  // Sinalização WebRTC para Chat de Voz
  socket.on("webrtc-offer", (payload: { targetSocketId: string; sdp: any }) => {
    io.to(payload.targetSocketId).emit("webrtc-offer", {
      senderSocketId: socket.id,
      sdp: payload.sdp
    })
  })

  socket.on("webrtc-answer", (payload: { targetSocketId: string; sdp: any }) => {
    io.to(payload.targetSocketId).emit("webrtc-answer", {
      senderSocketId: socket.id,
      sdp: payload.sdp
    })
  })

  socket.on("webrtc-ice-candidate", (payload: { targetSocketId: string; candidate: any }) => {
    io.to(payload.targetSocketId).emit("webrtc-ice-candidate", {
      senderSocketId: socket.id,
      candidate: payload.candidate
    })
  })

  // Transmissão do estado de mudo no chat de voz
  socket.on("toggle-mute", (payload: { codigo: string; muted: boolean }) => {
    socket.to(payload.codigo).emit("player-mute-updated", {
      socketId: socket.id,
      muted: payload.muted
    })
  })

  socket.on("selecionarRespondente", ({ codigo, respostaPlayerId }: { codigo: string; respostaPlayerId: string }) => {
    comSalaValida(codigo, (sala) => {
      const turno = sala.turno
      if (!turno || turno.fase !== "selecionar-respondente") return

      const jogadorAtual = sala.players.find(p => p.socketId === socket.id)
      if (!jogadorAtual || jogadorAtual.id !== turno.perguntaPlayerId) return

      if (!sala.jogadoresResponderam) sala.jogadoresResponderam = []
      if (sala.jogadoresResponderam.includes(respostaPlayerId)) return

      turno.respostaPlayerId = respostaPlayerId
      turno.fase = "em-andamento"
      turno.tempoRestante = 60

      io.to(codigo).emit("atualizarSala", sanitizarSala(sala))
      iniciarTimerTurno(codigo)
    }, socket)
  })

  socket.on("finalizarTurno", ({ codigo }: { codigo: string }) => {
    comSalaValida(codigo, (sala) => {
      const turno = sala.turno
      if (!turno || turno.fase !== "em-andamento") return

      const jogadorAtual = sala.players.find(p => p.socketId === socket.id)
      if (!jogadorAtual || (jogadorAtual.id !== turno.perguntaPlayerId && jogadorAtual.id !== turno.respostaPlayerId)) return

      pararTimerTurno(codigo)
      executarFinalizacaoTurno(codigo)
    }, socket)
  })

  socket.on("selecionarProximoPerguntador", ({ codigo, proximoPerguntadorId }: { codigo: string; proximoPerguntadorId: string }) => {
    comSalaValida(codigo, (sala) => {
      const turno = sala.turno
      if (!turno || turno.fase !== "selecionar-perguntador") return

      const jogadorAtual = sala.players.find(p => p.socketId === socket.id)
      if (!jogadorAtual || jogadorAtual.id !== turno.perguntaPlayerId) return

      if (!sala.jogadoresPerguntaram) sala.jogadoresPerguntaram = []
      if (sala.jogadoresPerguntaram.includes(proximoPerguntadorId)) return

      turno.perguntaPlayerId = proximoPerguntadorId
      turno.respostaPlayerId = null
      turno.fase = "selecionar-respondente"
      turno.tempoRestante = 60

      io.to(codigo).emit("atualizarSala", sanitizarSala(sala))
    }, socket)
  })

  // Tratamento de desconexão automática do socket com tolerância a restarts e oscilações
  socket.on("disconnect", () => {
    for (const codigo in salas) {
      const sala = salas[codigo]
      const jogadorExiste = sala.players.some(p => p.socketId === socket.id)
      
      if (jogadorExiste) {
        // Se a partida estiver rolando, NUNCA removemos o jogador da sala
        if (sala.jogoIniciado) {
          console.log(`[Socket] Jogador desconectado da sala ${codigo} com jogo em andamento. Mantendo dados para reconexão.`)
          io.to(codigo).emit("atualizarSala", sanitizarSala(sala))
          continue
        }

        // Se o jogo NÃO iniciou, aguardamos 5 segundos antes de remover (tolerância a oscilações curtas de rede)
        setTimeout(() => {
          const salaAtual = salas[codigo]
          if (!salaAtual) return

          const jogador = salaAtual.players.find(p => p.socketId === socket.id)
          // Se o jogador ainda estiver com o mesmo socketId inativo, removemos
          if (jogador && jogador.socketId === socket.id) {
            console.log(`[Socket] Removendo jogador inativo da sala ${codigo} após tempo limite.`)
            salaAtual.players = salaAtual.players.filter(p => p.socketId !== socket.id)
            
            if (salaAtual.players.length === 0) {
              delete salas[codigo]
              pararTimerTurno(codigo)
              io.emit("salaRemovida", codigo)
            } else {
              if (salaAtual.socketIdOwner === socket.id) {
                salaAtual.socketIdOwner = salaAtual.players[0].socketId
              }
              io.to(codigo).emit("atualizarSala", sanitizarSala(salaAtual))
            }
            salvarSalas(salas)
          }
        }, 5000)
      }
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

function sanitizarSala(sala: RoomDataDTO): Omit<RoomDataDTO, 'password'> {
  const { password, ...salaSemSenha } = sala
  return salaSemSenha
}
