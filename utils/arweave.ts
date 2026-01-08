import { getApiEndpoints } from '~/constant/api'

class Provider {
  pubKey: Buffer | null = null
  fileSize = 0
  ipfsHash = ''
  txHash = ''
  token = ''

  constructor ({
    publicKey,
    fileSize,
    ipfsHash,
    txHash,
    token
  }: {
    publicKey: string
    fileSize: number
    ipfsHash: string
    txHash: string
    token: string
  }) {
    this.pubKey = Buffer.from(publicKey, 'base64')
    this.fileSize = fileSize
    this.ipfsHash = ipfsHash
    this.txHash = txHash
    this.token = token
  }

  setLikeCoinTxInfo ({
    fileSize,
    ipfsHash,
    txHash
  }: {
    fileSize: number
    ipfsHash: string
    txHash: string
  }) {
    this.fileSize = fileSize
    this.ipfsHash = ipfsHash
    this.txHash = txHash
  }

  setPublicKey (newPubKey: string) {
    this.pubKey = Buffer.from(newPubKey, 'base64')
  }

  getPublicKey () {
    return this.pubKey
  }

  setAuthToken (token: string) {
    this.token = token
  }

  getSigner = () => ({
    getAddress: () => this.pubKey?.toString(),
    _signTypedData: async (
      _domain: never,
      _types: never,
      message: { address: string; 'Transaction hash': Uint8Array }
    ) => {
      const convertedMsg = Buffer.from(message['Transaction hash']).toString(
        'base64'
      )
      const apiEndpoints = getApiEndpoints()
      const res = await $fetch(apiEndpoints.API_POST_ARWEAVE_V2_SIGN, {
        method: 'POST',
        body: {
          signatureData: convertedMsg,
          fileSize: this.fileSize,
          ipfsHash: this.ipfsHash,
          txToken: 'BASEETH',
          txHash: this.txHash
        },
        headers: { Authorization: this.token ? `Bearer ${this.token}` : '' }
      })
      const { signature } = res as any
      const bSig = Buffer.from(signature, 'base64')
      // pad & convert so it's in the format the signer expects to have to convert from.
      const pad = Buffer.concat([
        Buffer.from([0]) as Buffer,
        bSig as any
      ]).toString(
        'hex'
      )
      return pad
    }
  })

  _ready () {}
}

let WebIrys: any = null

async function getProvider ({
  fileSize,
  ipfsHash,
  txHash,
  token
}: {
  fileSize: number
  ipfsHash: string
  txHash: string
  token: string
}) {
  const apiEndpoints = getApiEndpoints()
  const data = await $fetch(apiEndpoints.API_GET_ARWEAVE_V2_PUBLIC_KEY)
  const { publicKey } = data as { publicKey: string }
  const provider = new Provider({ publicKey, fileSize, ipfsHash, txHash, token })
  return provider
}

async function getBundler ({
  fileSize,
  ipfsHash,
  txHash,
  token
}: {
  fileSize: number
  ipfsHash: string
  txHash: string
  token: string
}) {
  if (!WebIrys) {
    ({ WebIrys } = (await import('@irys/sdk')))
  }
  const p = await getProvider({ fileSize, ipfsHash, txHash, token })
  const { IS_TESTNET } = useRuntimeConfig().public
  const bundlr = new WebIrys({
    network: IS_TESTNET ? 'devnet' : 'mainnet',
    url: IS_TESTNET ? 'https://devnet.irysnetwork.com' : 'https://node1.irysnetwork.com',
    token: 'base-eth',
    wallet: {
      provider: p
    }
  })
  await bundlr.ready()
  return bundlr
}

export async function estimateBundlrFilePrice ({
  fileSize,
  ipfsHash
}: {
  fileSize: number
  ipfsHash?: string
}) {
  const apiEndpoints = getApiEndpoints()
  const data = await $fetch(apiEndpoints.API_POST_ARWEAVE_V2_ESTIMATE, {
    method: 'POST',
    body: {
      fileSize,
      ipfsHash
    }
  })
  return data
}

export async function uploadSingleFileToBundlr (
  file: Buffer,
  {
    fileType,
    fileSize,
    ipfsHash,
    txHash,
    token,
    key
  }: { fileSize: number; fileType?: string, ipfsHash: string; txHash: string, token: string, key?: string }
) {
  const bundler = await getBundler({ fileSize, ipfsHash, txHash, token })
  const tags = [
    { name: 'App-Name', value: 'publish.3ook.com' },
    { name: 'App-Version', value: '2.0' },
    { name: 'User-Agent', value: 'publish.3ook.com' },
    { name: 'IPFS-CID', value: ipfsHash }
  ]
  if (fileType) { tags.push({ name: 'Content-Type', value: fileType }) }
  if (key) { tags.push({ name: 'Content-Encoding', value: 'aes256gcm' }) }
  const response = await bundler.upload(file, { tags })
  const arweaveId = response.id
  const { ARWEAVE_ENDPOINT } = useRuntimeConfig().public
  let arweaveLink = `${ARWEAVE_ENDPOINT}/${arweaveId}`
  if (arweaveId) {
    const apiEndpoints = getApiEndpoints()
    const data = await $fetch(apiEndpoints.API_POST_ARWEAVE_V2_REGISTER, {
      method: 'POST',
      body: {
        fileSize,
        ipfsHash,
        txHash,
        arweaveId,
        key
      },
      headers: { Authorization: token ? `Bearer ${token}` : '' }
    })
    const result = data as { link?: string }
    if (result?.link) {
      arweaveLink = result.link
    }
  }
  return {
    arweaveId,
    arweaveLink,
    arweaveKey: key
  }
}
