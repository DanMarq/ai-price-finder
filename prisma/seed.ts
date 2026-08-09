import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL })
const prisma = new PrismaClient({ adapter })

const STORES = [
  {
    slug: "mercado-livre",
    name: "Mercado Livre",
    providerKey: "mercado_livre",
    websiteUrl: "https://www.mercadolivre.com.br",
  },
  {
    slug: "decathlon",
    name: "Decathlon",
    providerKey: "vtex:decathlon",
    websiteUrl: "https://www.decathlon.com.br",
  },
  {
    slug: "reserva",
    name: "Reserva",
    providerKey: "vtex:reserva",
    websiteUrl: "https://www.usereserva.com",
  },
  {
    slug: "pbkids",
    name: "PBKids",
    providerKey: "vtex-is:pbkids",
    websiteUrl: "https://www.pbkids.com.br",
  },
  {
    slug: "carrefour",
    name: "Carrefour",
    providerKey: "vtex:carrefour",
    websiteUrl: "https://www.carrefour.com.br",
  },
  {
    slug: "cea",
    name: "C&A",
    providerKey: "vtex:cea",
    websiteUrl: "https://www.cea.com.br",
  },
  {
    slug: "paguemenos",
    name: "Pague Menos",
    providerKey: "vtex:paguemenos",
    websiteUrl: "https://www.paguemenos.com.br",
  },
  {
    slug: "americanas",
    name: "Americanas",
    providerKey: "vtex:americanas",
    websiteUrl: "https://www.americanas.com.br",
  },
  {
    slug: "drogariasaopaulo",
    name: "Droga São Paulo",
    providerKey: "vtex:drogariasaopaulo",
    websiteUrl: "https://www.drogariasaopaulo.com.br",
  },
  {
    slug: "tokstok",
    name: "Tok&Stok",
    providerKey: "vtex:tokstok",
    websiteUrl: "https://www.tokstok.com.br",
  },
  {
    slug: "cobasi",
    name: "Cobasi",
    providerKey: "vtex:cobasi",
    websiteUrl: "https://www.cobasi.com.br",
  },
  {
    slug: "zonasul",
    name: "Zona Sul",
    providerKey: "vtex:zonasul",
    websiteUrl: "https://www.zonasul.com.br",
  },
]

async function main() {
  for (const store of STORES) {
    await prisma.store.upsert({
      where: { slug: store.slug },
      create: { ...store, isActive: true },
      update: { name: store.name, providerKey: store.providerKey, websiteUrl: store.websiteUrl },
    });
  }
  console.log(`Seed concluído: ${STORES.length} loja(s).`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })