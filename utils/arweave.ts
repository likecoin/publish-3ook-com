import { getApiEndpoints } from '~/constant/api'
import type { ArweaveEstimate } from '~/types'
import { uploadToIrys } from '~/utils/irys'

export async function estimateBundlrFilePrice ({
  fileSize,
  ipfsHash
}: {
  fileSize: number
  ipfsHash?: string
}): Promise<ArweaveEstimate> {
  const apiEndpoints = getApiEndpoints()
  const data = await $fetch<ArweaveEstimate>(apiEndpoints.API_POST_ARWEAVE_V2_ESTIMATE, {
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
  }: { fileSize: number; fileType?: string; ipfsHash: string; txHash: string; token: string; key?: string }
) {
  const tags = [
    { name: 'App-Name', value: 'publish.3ook.com' },
    { name: 'App-Version', value: '2.0' },
    { name: 'User-Agent', value: 'publish.3ook.com' },
    { name: 'IPFS-CID', value: ipfsHash }
  ]
  if (fileType) { tags.push({ name: 'Content-Type', value: fileType }) }
  if (key) { tags.push({ name: 'Content-Encoding', value: 'aes256gcm' }) }

  const { id: arweaveId } = await uploadToIrys(file, {
    tags,
    fileSize,
    ipfsHash,
    txHash,
    token
  })

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
