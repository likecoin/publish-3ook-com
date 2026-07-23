export function getApiEndpoints() {
  const { LIKE_CO_API } = useRuntimeConfig().public

  return {
    API_POST_ARWEAVE_V2_SIGN: `${LIKE_CO_API}/arweave/v2/sign_payment_data`,
    API_GET_ARWEAVE_V2_PUBLIC_KEY: `${LIKE_CO_API}/arweave/v2/public_key`,
    API_POST_ARWEAVE_V2_ESTIMATE: `${LIKE_CO_API}/arweave/v2/estimate`,
    API_POST_ARWEAVE_V2_REGISTER: `${LIKE_CO_API}/arweave/v2/register`,
    API_GET_ARWEAVE_V2_LINK: `${LIKE_CO_API}/arweave/v2/link`,
    API_POST_ARWEAVE_V2_GCS_UPLOAD_INIT: `${LIKE_CO_API}/arweave/v2/gcs/upload_init`,
    API_POST_ARWEAVE_V2_GCS_FINALIZE: `${LIKE_CO_API}/arweave/v2/gcs/finalize`,
  }
}
