export function getApiEndpoints() {
  const { LIKE_CO_API } = useRuntimeConfig().public

  return {
    API_POST_ARWEAVE_V2_ESTIMATE: `${LIKE_CO_API}/arweave/v2/estimate`,
    API_GET_ARWEAVE_V2_LINK: `${LIKE_CO_API}/arweave/v2/link`,
    API_POST_ARWEAVE_V2_GCS_UPLOAD_INIT: `${LIKE_CO_API}/arweave/v2/gcs/upload_init`,
    API_POST_ARWEAVE_V2_GCS_FINALIZE: `${LIKE_CO_API}/arweave/v2/gcs/finalize`,
    API_POST_ARWEAVE_V2_GCS_ARWEAVE: `${LIKE_CO_API}/arweave/v2/gcs/arweave`,
  }
}
