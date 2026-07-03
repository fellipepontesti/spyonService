import "reflect-metadata"
import { DataSource } from "typeorm"
import { User } from "../domain/entities/User"
import { UserPoints } from "../domain/entities/UserPoints"
import * as dotenv from "dotenv"

// Carrega as variáveis do arquivo .env
dotenv.config()

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.PGHOST || "localhost",
  port: parseInt(process.env.PGPORT || "5432"),
  username: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "postgres",
  database: process.env.PGDATABASE || "spyon_development",
  synchronize: true, // Cria/sincroniza a estrutura da tabela no banco automaticamente
  logging: false,
  entities: [User, UserPoints],
  migrations: [],
  subscribers: [],
})

export async function inicializarBanco() {
  try {
    await AppDataSource.initialize()
    console.log("Banco de dados PostgreSQL inicializado com sucesso via TypeORM!")
  } catch (error) {
    console.error("Erro ao inicializar o banco de dados via TypeORM:", error)
  }
}

export async function incrementarPartidas(userIds: string[]) {
  if (userIds.length === 0) return
  try {
    const userRepository = AppDataSource.getRepository(User)
    await userRepository
      .createQueryBuilder()
      .update(User)
      .set({ quantidadePartidas: () => "quantidade_de_partidas + 1" })
      .where("id IN (:...ids)", { ids: userIds })
      .execute()
  } catch (error) {
    console.error("Erro ao incrementar partidas no banco:", error)
  }
}

export async function incrementarVitoriasComuns(userIds: string[]) {
  if (userIds.length === 0) return
  try {
    const pointsRepository = AppDataSource.getRepository(UserPoints)
    await pointsRepository
      .createQueryBuilder()
      .update(UserPoints)
      .set({ vitoriasComuns: () => "vitorias_comuns + 1" })
      .where("user_id IN (:...ids)", { ids: userIds })
      .execute()
  } catch (error) {
    console.error("Erro ao incrementar vitorias comuns no banco:", error)
  }
}

export async function incrementarVitoriasImpostor(userIds: string[]) {
  if (userIds.length === 0) return
  try {
    const pointsRepository = AppDataSource.getRepository(UserPoints)
    await pointsRepository
      .createQueryBuilder()
      .update(UserPoints)
      .set({ vitoriasImpostor: () => "vitorias_impostor + 1" })
      .where("user_id IN (:...ids)", { ids: userIds })
      .execute()
  } catch (error) {
    console.error("Erro ao incrementar vitorias impostor no banco:", error)
  }
}
