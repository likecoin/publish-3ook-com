import{d as h,w as Ae,p as $e,R as u,e as f,f as ne,a as A,E as _,h as ie,W as re,C as w,B as H,i as ae,j as te,A as K,k as G,l as Me,m as Pe,n as je,o as le,s as Ie,q as Ne,M as S,r as se,t as T,u as J,v as k,x as c,y as Ee,z as me,D as He,F as D,O as b,G as We,c as oe,T as Ve,H as Ke,P as Ge}from"./B2LnQrQp.js";import{c as v,n as m,o as de,r as p,U as Re}from"./CsFhbik5.js";import"./9S2XGRg9.js";import"./BUjaqu0r.js";import"./DAFhUC3E.js";import"./BP1oHQun.js";(function(){try{var e=typeof window<"u"?window:typeof global<"u"?global:typeof globalThis<"u"?globalThis:typeof self<"u"?self:{};e.SENTRY_RELEASE={id:"cd189bad150b481aa5ecb2e95de26ec677010e55"}}catch{}})();try{(function(){var e=typeof window<"u"?window:typeof global<"u"?global:typeof globalThis<"u"?globalThis:typeof self<"u"?self:{},t=new e.Error().stack;t&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[t]="48d02d18-3127-4a5f-8504-4597bb5b1f89",e._sentryDebugIdIdentifier="sentry-dbid-48d02d18-3127-4a5f-8504-4597bb5b1f89")})()}catch{}const N={getGasPriceInEther(e,t){const o=t*e;return Number(o)/1e18},getGasPriceInUSD(e,t,o){const r=N.getGasPriceInEther(t,o);return h.bigNumber(e).times(r).toNumber()},getPriceImpact({sourceTokenAmount:e,sourceTokenPriceInUSD:t,toTokenPriceInUSD:o,toTokenAmount:r}){const a=h.bigNumber(e).times(t),n=h.bigNumber(r).times(o);return a.minus(n).div(a).times(100).toNumber()},getMaxSlippage(e,t){const o=h.bigNumber(e).div(100);return h.multiply(t,o).toNumber()},getProviderFee(e,t=.0085){return h.bigNumber(e).times(t).toString()},isInsufficientNetworkTokenForGas(e,t){const o=t||"0";return h.bigNumber(e).eq(0)?!0:h.bigNumber(h.bigNumber(o)).gt(e)},isInsufficientSourceTokenForSwap(e,t,o){const r=o?.find(n=>n.address===t)?.quantity?.numeric;return h.bigNumber(r||"0").lt(e)}},ke=15e4,Ye=6,y={initializing:!1,initialized:!1,loadingPrices:!1,loadingQuote:!1,loadingApprovalTransaction:!1,loadingBuildTransaction:!1,loadingTransaction:!1,fetchError:!1,approvalTransaction:void 0,swapTransaction:void 0,transactionError:void 0,sourceToken:void 0,sourceTokenAmount:"",sourceTokenPriceInUSD:0,toToken:void 0,toTokenAmount:"",toTokenPriceInUSD:0,networkPrice:"0",networkBalanceInUSD:"0",networkTokenSymbol:"",inputError:void 0,slippage:Pe.CONVERT_SLIPPAGE_TOLERANCE,tokens:void 0,popularTokens:void 0,suggestedTokens:void 0,foundTokens:void 0,myTokensWithBalance:void 0,tokensPriceMap:{},gasFee:"0",gasPriceInUSD:0,priceImpact:void 0,maxSlippage:void 0,providerFee:void 0},i=$e({...y}),ce={state:i,subscribe(e){return Ne(i,()=>e(i))},subscribeKey(e,t){return Ie(i,e,t)},getParams(){const e=w.state.activeChain,t=K.getCaipAddress(e)??w.state.activeCaipAddress,o=ae.getPlainAddress(t),r=je(),a=le.getConnectorId(w.state.activeChain);if(!o)throw new Error("No address found to swap the tokens from.");const n=!i.toToken?.address||!i.toToken?.decimals,s=!i.sourceToken?.address||!i.sourceToken?.decimals||!h.bigNumber(i.sourceTokenAmount).gt(0),l=!i.sourceTokenAmount;return{networkAddress:r,fromAddress:o,fromCaipAddress:t,sourceTokenAddress:i.sourceToken?.address,toTokenAddress:i.toToken?.address,toTokenAmount:i.toTokenAmount,toTokenDecimals:i.toToken?.decimals,sourceTokenAmount:i.sourceTokenAmount,sourceTokenDecimals:i.sourceToken?.decimals,invalidToToken:n,invalidSourceToken:s,invalidSourceTokenAmount:l,availableToSwap:t&&!n&&!s&&!l,isAuthConnector:a===A.CONNECTOR_ID.AUTH}},setSourceToken(e){if(!e){i.sourceToken=e,i.sourceTokenAmount="",i.sourceTokenPriceInUSD=0;return}i.sourceToken=e,d.setTokenPrice(e.address,"sourceToken")},setSourceTokenAmount(e){i.sourceTokenAmount=e},setToToken(e){if(!e){i.toToken=e,i.toTokenAmount="",i.toTokenPriceInUSD=0;return}i.toToken=e,d.setTokenPrice(e.address,"toToken")},setToTokenAmount(e){i.toTokenAmount=e?h.toFixed(e,Ye):""},async setTokenPrice(e,t){let o=i.tokensPriceMap[e]||0;o||(i.loadingPrices=!0,o=await d.getAddressPrice(e)),t==="sourceToken"?i.sourceTokenPriceInUSD=o:t==="toToken"&&(i.toTokenPriceInUSD=o),i.loadingPrices&&(i.loadingPrices=!1),d.getParams().availableToSwap&&d.swapTokens()},switchTokens(){if(i.initializing||!i.initialized)return;const e=i.toToken?{...i.toToken}:void 0,t=i.sourceToken?{...i.sourceToken}:void 0,o=e&&i.toTokenAmount===""?"1":i.toTokenAmount;d.setSourceToken(e),d.setToToken(t),d.setSourceTokenAmount(o),d.setToTokenAmount(""),d.swapTokens()},resetState(){i.myTokensWithBalance=y.myTokensWithBalance,i.tokensPriceMap=y.tokensPriceMap,i.initialized=y.initialized,i.initializing=y.initializing,i.sourceToken=y.sourceToken,i.sourceTokenAmount=y.sourceTokenAmount,i.sourceTokenPriceInUSD=y.sourceTokenPriceInUSD,i.toToken=y.toToken,i.toTokenAmount=y.toTokenAmount,i.toTokenPriceInUSD=y.toTokenPriceInUSD,i.networkPrice=y.networkPrice,i.networkTokenSymbol=y.networkTokenSymbol,i.networkBalanceInUSD=y.networkBalanceInUSD,i.inputError=y.inputError},resetValues(){const{networkAddress:e}=d.getParams(),t=i.tokens?.find(o=>o.address===e);d.setSourceToken(t),d.setToToken(void 0)},getApprovalLoadingState(){return i.loadingApprovalTransaction},clearError(){i.transactionError=void 0},async initializeState(){if(!i.initializing){if(i.initializing=!0,!i.initialized)try{await d.fetchTokens(),i.initialized=!0}catch{i.initialized=!1,f.showError("Failed to initialize swap"),u.goBack()}i.initializing=!1}},async fetchTokens(){const{networkAddress:e}=d.getParams();await d.getNetworkTokenPrice(),await d.getMyTokensWithBalance();const t=i.myTokensWithBalance?.find(o=>o.address===e);t&&(i.networkTokenSymbol=t.symbol,d.setSourceToken(t),d.setSourceTokenAmount("0"))},async getTokenList(){const e=w.state.activeCaipNetwork?.caipNetworkId;if(!(i.caipNetworkId===e&&i.tokens))try{i.tokensLoading=!0;const t=await te.getTokenList(e);i.tokens=t,i.caipNetworkId=e,i.popularTokens=t.sort((o,r)=>o.symbol<r.symbol?-1:o.symbol>r.symbol?1:0),i.suggestedTokens=t.filter(o=>!!Pe.SWAP_SUGGESTED_TOKENS.includes(o.symbol))}catch{i.tokens=[],i.popularTokens=[],i.suggestedTokens=[]}finally{i.tokensLoading=!1}},async getAddressPrice(e){const t=i.tokensPriceMap[e];if(t)return t;const r=(await H.fetchTokenPrice({addresses:[e]}))?.fungibles||[],n=[...i.tokens||[],...i.myTokensWithBalance||[]]?.find(g=>g.address===e)?.symbol,s=r.find(g=>g.symbol.toLowerCase()===n?.toLowerCase())?.price||0,l=parseFloat(s.toString());return i.tokensPriceMap[e]=l,l},async getNetworkTokenPrice(){const{networkAddress:e}=d.getParams(),o=(await H.fetchTokenPrice({addresses:[e]}).catch(()=>(f.showError("Failed to fetch network token price"),{fungibles:[]}))).fungibles?.[0],r=o?.price.toString()||"0";i.tokensPriceMap[e]=parseFloat(r),i.networkTokenSymbol=o?.symbol||"",i.networkPrice=r},async getMyTokensWithBalance(e){const t=await Me.getMyTokensWithBalance(e),o=te.mapBalancesToSwapTokens(t);o&&(await d.getInitialGasPrice(),d.setBalances(o))},setBalances(e){const{networkAddress:t}=d.getParams(),o=w.state.activeCaipNetwork;if(!o)return;const r=e.find(a=>a.address===t);e.forEach(a=>{i.tokensPriceMap[a.address]=a.price||0}),i.myTokensWithBalance=e.filter(a=>a.address.startsWith(o.caipNetworkId)),i.networkBalanceInUSD=r?h.multiply(r.quantity.numeric,r.price).toString():"0"},async getInitialGasPrice(){const e=await te.fetchGasPrice();if(!e)return{gasPrice:null,gasPriceInUSD:null};switch(w.state?.activeCaipNetwork?.chainNamespace){case A.CHAIN.SOLANA:return i.gasFee=e.standard??"0",i.gasPriceInUSD=h.multiply(e.standard,i.networkPrice).div(1e9).toNumber(),{gasPrice:BigInt(i.gasFee),gasPriceInUSD:Number(i.gasPriceInUSD)};case A.CHAIN.EVM:default:const t=e.standard??"0",o=BigInt(t),r=BigInt(ke),a=N.getGasPriceInUSD(i.networkPrice,r,o);return i.gasFee=t,i.gasPriceInUSD=a,{gasPrice:o,gasPriceInUSD:a}}},async swapTokens(){const e=K.state.address,t=i.sourceToken,o=i.toToken,r=h.bigNumber(i.sourceTokenAmount).gt(0);if(r||d.setToTokenAmount(""),!o||!t||i.loadingPrices||!r)return;i.loadingQuote=!0;const a=h.bigNumber(i.sourceTokenAmount).times(10**t.decimals).round(0);try{const n=await H.fetchSwapQuote({userAddress:e,from:t.address,to:o.address,gasPrice:i.gasFee,amount:a.toString()});i.loadingQuote=!1;const s=n?.quotes?.[0]?.toAmount;if(!s){G.open({displayMessage:"Incorrect amount",debugMessage:"Please enter a valid amount"},"error");return}const l=h.bigNumber(s).div(10**o.decimals).toString();d.setToTokenAmount(l),d.hasInsufficientToken(i.sourceTokenAmount,t.address)?i.inputError="Insufficient balance":(i.inputError=void 0,d.setTransactionDetails())}catch{i.loadingQuote=!1,i.inputError="Insufficient balance"}},async getTransaction(){const{fromCaipAddress:e,availableToSwap:t}=d.getParams(),o=i.sourceToken,r=i.toToken;if(!(!e||!t||!o||!r||i.loadingQuote))try{i.loadingBuildTransaction=!0;const a=await te.fetchSwapAllowance({userAddress:e,tokenAddress:o.address,sourceTokenAmount:i.sourceTokenAmount,sourceTokenDecimals:o.decimals});let n;return a?n=await d.createSwapTransaction():n=await d.createAllowanceTransaction(),i.loadingBuildTransaction=!1,i.fetchError=!1,n}catch{u.goBack(),f.showError("Failed to check allowance"),i.loadingBuildTransaction=!1,i.approvalTransaction=void 0,i.swapTransaction=void 0,i.fetchError=!0;return}},async createAllowanceTransaction(){const{fromCaipAddress:e,sourceTokenAddress:t,toTokenAddress:o}=d.getParams();if(!(!e||!o)){if(!t)throw new Error("createAllowanceTransaction - No source token address found.");try{const r=await H.generateApproveCalldata({from:t,to:o,userAddress:e}),a=ae.getPlainAddress(r.tx.from);if(!a)throw new Error("SwapController:createAllowanceTransaction - address is required");const n={data:r.tx.data,to:a,gasPrice:BigInt(r.tx.eip155.gasPrice),value:BigInt(r.tx.value),toAmount:i.toTokenAmount};return i.swapTransaction=void 0,i.approvalTransaction={data:n.data,to:n.to,gasPrice:n.gasPrice,value:n.value,toAmount:n.toAmount},{data:n.data,to:n.to,gasPrice:n.gasPrice,value:n.value,toAmount:n.toAmount}}catch{u.goBack(),f.showError("Failed to create approval transaction"),i.approvalTransaction=void 0,i.swapTransaction=void 0,i.fetchError=!0;return}}},async createSwapTransaction(){const{networkAddress:e,fromCaipAddress:t,sourceTokenAmount:o}=d.getParams(),r=i.sourceToken,a=i.toToken;if(!t||!o||!r||!a)return;const n=ne.parseUnits(o,r.decimals)?.toString();try{const s=await H.generateSwapCalldata({userAddress:t,from:r.address,to:a.address,amount:n,disableEstimate:!0}),l=r.address===e,g=BigInt(s.tx.eip155.gas),U=BigInt(s.tx.eip155.gasPrice),z=ae.getPlainAddress(s.tx.to);if(!z)throw new Error("SwapController:createSwapTransaction - address is required");const F={data:s.tx.data,to:z,gas:g,gasPrice:U,value:BigInt(l?n??"0":"0"),toAmount:i.toTokenAmount};return i.gasPriceInUSD=N.getGasPriceInUSD(i.networkPrice,g,U),i.approvalTransaction=void 0,i.swapTransaction=F,F}catch{u.goBack(),f.showError("Failed to create transaction"),i.approvalTransaction=void 0,i.swapTransaction=void 0,i.fetchError=!0;return}},onEmbeddedWalletApprovalSuccess(){f.showLoading("Approve limit increase in your wallet"),u.replace("SwapPreview")},async sendTransactionForApproval(e){const{fromAddress:t,isAuthConnector:o}=d.getParams();i.loadingApprovalTransaction=!0,o?u.pushTransactionStack({onSuccess:d.onEmbeddedWalletApprovalSuccess}):f.showLoading("Approve limit increase in your wallet");try{await ne.sendTransaction({address:t,to:e.to,data:e.data,value:e.value,chainNamespace:A.CHAIN.EVM}),await d.swapTokens(),await d.getTransaction(),i.approvalTransaction=void 0,i.loadingApprovalTransaction=!1}catch(a){const n=a;i.transactionError=n?.displayMessage,i.loadingApprovalTransaction=!1,f.showError(n?.displayMessage||"Transaction error"),_.sendEvent({type:"track",event:"SWAP_APPROVAL_ERROR",properties:{message:n?.displayMessage||n?.message||"Unknown",network:w.state.activeCaipNetwork?.caipNetworkId||"",swapFromToken:d.state.sourceToken?.symbol||"",swapToToken:d.state.toToken?.symbol||"",swapFromAmount:d.state.sourceTokenAmount||"",swapToAmount:d.state.toTokenAmount||"",isSmartAccount:ie(A.CHAIN.EVM)===re.ACCOUNT_TYPES.SMART_ACCOUNT}})}},async sendTransactionForSwap(e){if(!e)return;const{fromAddress:t,toTokenAmount:o,isAuthConnector:r}=d.getParams();i.loadingTransaction=!0;const a=`Swapping ${i.sourceToken?.symbol} to ${h.formatNumberToLocalString(o,3)} ${i.toToken?.symbol}`,n=`Swapped ${i.sourceToken?.symbol} to ${h.formatNumberToLocalString(o,3)} ${i.toToken?.symbol}`;r?u.pushTransactionStack({onSuccess(){u.replace("Account"),f.showLoading(a),ce.resetState()}}):f.showLoading("Confirm transaction in your wallet");try{const s=[i.sourceToken?.address,i.toToken?.address].join(","),l=await ne.sendTransaction({address:t,to:e.to,data:e.data,value:e.value,chainNamespace:A.CHAIN.EVM});return i.loadingTransaction=!1,f.showSuccess(n),_.sendEvent({type:"track",event:"SWAP_SUCCESS",properties:{network:w.state.activeCaipNetwork?.caipNetworkId||"",swapFromToken:d.state.sourceToken?.symbol||"",swapToToken:d.state.toToken?.symbol||"",swapFromAmount:d.state.sourceTokenAmount||"",swapToAmount:d.state.toTokenAmount||"",isSmartAccount:ie(A.CHAIN.EVM)===re.ACCOUNT_TYPES.SMART_ACCOUNT}}),ce.resetState(),r||u.replace("Account"),ce.getMyTokensWithBalance(s),l}catch(s){const l=s;i.transactionError=l?.displayMessage,i.loadingTransaction=!1,f.showError(l?.displayMessage||"Transaction error"),_.sendEvent({type:"track",event:"SWAP_ERROR",properties:{message:l?.displayMessage||l?.message||"Unknown",network:w.state.activeCaipNetwork?.caipNetworkId||"",swapFromToken:d.state.sourceToken?.symbol||"",swapToToken:d.state.toToken?.symbol||"",swapFromAmount:d.state.sourceTokenAmount||"",swapToAmount:d.state.toTokenAmount||"",isSmartAccount:ie(A.CHAIN.EVM)===re.ACCOUNT_TYPES.SMART_ACCOUNT}});return}},hasInsufficientToken(e,t){return N.isInsufficientSourceTokenForSwap(e,t,i.myTokensWithBalance)},setTransactionDetails(){const{toTokenAddress:e,toTokenDecimals:t}=d.getParams();!e||!t||(i.gasPriceInUSD=N.getGasPriceInUSD(i.networkPrice,BigInt(i.gasFee),BigInt(ke)),i.priceImpact=N.getPriceImpact({sourceTokenAmount:i.sourceTokenAmount,sourceTokenPriceInUSD:i.sourceTokenPriceInUSD,toTokenPriceInUSD:i.toTokenPriceInUSD,toTokenAmount:i.toTokenAmount}),i.maxSlippage=N.getMaxSlippage(i.slippage,i.toTokenAmount),i.providerFee=N.getProviderFee(i.sourceTokenAmount))}},d=Ae(ce),x=$e({message:"",open:!1,triggerRect:{width:0,height:0,top:0,left:0},variant:"shade"}),Xe={state:x,subscribe(e){return Ne(x,()=>e(x))},subscribeKey(e,t){return Ie(x,e,t)},showTooltip({message:e,triggerRect:t,variant:o}){x.open=!0,x.message=e,x.triggerRect=t,x.variant=o},hide(){x.open=!1,x.message="",x.triggerRect={width:0,height:0,top:0,left:0}}},V=Ae(Xe),Oe={isUnsupportedChainView(){return u.state.view==="UnsupportedChain"||u.state.view==="SwitchNetwork"&&u.state.history.includes("UnsupportedChain")},async safeClose(){if(this.isUnsupportedChainView()){S.shake();return}if(await se.isSIWXCloseDisabled()){S.shake();return}(u.state.view==="DataCapture"||u.state.view==="DataCaptureOtpConfirm")&&ne.disconnect(),S.close()}},qe=T`
  :host {
    display: block;
    border-radius: clamp(0px, ${({borderRadius:e})=>e[8]}, 44px);
    box-shadow: 0 0 0 1px ${({tokens:e})=>e.theme.foregroundPrimary};
    background-color: ${({tokens:e})=>e.theme.backgroundPrimary};
    overflow: hidden;
  }
`;var Qe=function(e,t,o,r){var a=arguments.length,n=a<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,o):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,o,r);else for(var l=e.length-1;l>=0;l--)(s=e[l])&&(n=(a<3?s(n):a>3?s(t,o,n):s(t,o))||n);return a>3&&n&&Object.defineProperty(t,o,n),n};let he=class extends k{render(){return c`<slot></slot>`}};he.styles=[J,qe];he=Qe([v("wui-card")],he);const Ze=T`
  :host {
    width: 100%;
  }

  :host > wui-flex {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: ${({spacing:e})=>e[2]};
    padding: ${({spacing:e})=>e[3]};
    border-radius: ${({borderRadius:e})=>e[6]};
    border: 1px solid ${({tokens:e})=>e.theme.borderPrimary};
    box-sizing: border-box;
    background-color: ${({tokens:e})=>e.theme.foregroundPrimary};
    box-shadow: 0px 0px 16px 0px rgba(0, 0, 0, 0.25);
    color: ${({tokens:e})=>e.theme.textPrimary};
  }

  :host > wui-flex[data-type='info'] {
    .icon-box {
      background-color: ${({tokens:e})=>e.theme.foregroundSecondary};

      wui-icon {
        color: ${({tokens:e})=>e.theme.iconDefault};
      }
    }
  }
  :host > wui-flex[data-type='success'] {
    .icon-box {
      background-color: ${({tokens:e})=>e.core.backgroundSuccess};

      wui-icon {
        color: ${({tokens:e})=>e.core.borderSuccess};
      }
    }
  }
  :host > wui-flex[data-type='warning'] {
    .icon-box {
      background-color: ${({tokens:e})=>e.core.backgroundWarning};

      wui-icon {
        color: ${({tokens:e})=>e.core.borderWarning};
      }
    }
  }
  :host > wui-flex[data-type='error'] {
    .icon-box {
      background-color: ${({tokens:e})=>e.core.backgroundError};

      wui-icon {
        color: ${({tokens:e})=>e.core.borderError};
      }
    }
  }

  wui-flex {
    width: 100%;
  }

  wui-text {
    word-break: break-word;
    flex: 1;
  }

  .close {
    cursor: pointer;
    color: ${({tokens:e})=>e.theme.iconDefault};
  }

  .icon-box {
    height: 40px;
    width: 40px;
    border-radius: ${({borderRadius:e})=>e[2]};
    background-color: var(--local-icon-bg-value);
  }
`;var ge=function(e,t,o,r){var a=arguments.length,n=a<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,o):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,o,r);else for(var l=e.length-1;l>=0;l--)(s=e[l])&&(n=(a<3?s(n):a>3?s(t,o,n):s(t,o))||n);return a>3&&n&&Object.defineProperty(t,o,n),n};const Je={info:"info",success:"checkmark",warning:"warningCircle",error:"warning"};let X=class extends k{constructor(){super(...arguments),this.message="",this.type="info"}render(){return c`
      <wui-flex
        data-type=${de(this.type)}
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        gap="2"
      >
        <wui-flex columnGap="2" flexDirection="row" alignItems="center">
          <wui-flex
            flexDirection="row"
            alignItems="center"
            justifyContent="center"
            class="icon-box"
          >
            <wui-icon color="inherit" size="md" name=${Je[this.type]}></wui-icon>
          </wui-flex>
          <wui-text variant="md-medium" color="inherit" data-testid="wui-alertbar-text"
            >${this.message}</wui-text
          >
        </wui-flex>
        <wui-icon
          class="close"
          color="inherit"
          size="sm"
          name="close"
          @click=${this.onClose}
        ></wui-icon>
      </wui-flex>
    `}onClose(){G.close()}};X.styles=[J,Ze];ge([m()],X.prototype,"message",void 0);ge([m()],X.prototype,"type",void 0);X=ge([v("wui-alertbar")],X);const et=T`
  :host {
    display: block;
    position: absolute;
    top: ${({spacing:e})=>e[3]};
    left: ${({spacing:e})=>e[4]};
    right: ${({spacing:e})=>e[4]};
    opacity: 0;
    pointer-events: none;
  }
`;var De=function(e,t,o,r){var a=arguments.length,n=a<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,o):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,o,r);else for(var l=e.length-1;l>=0;l--)(s=e[l])&&(n=(a<3?s(n):a>3?s(t,o,n):s(t,o))||n);return a>3&&n&&Object.defineProperty(t,o,n),n};const tt={info:{backgroundColor:"fg-350",iconColor:"fg-325",icon:"info"},success:{backgroundColor:"success-glass-reown-020",iconColor:"success-125",icon:"checkmark"},warning:{backgroundColor:"warning-glass-reown-020",iconColor:"warning-100",icon:"warningCircle"},error:{backgroundColor:"error-glass-reown-020",iconColor:"error-125",icon:"warning"}};let ue=class extends k{constructor(){super(),this.unsubscribe=[],this.open=G.state.open,this.onOpen(!0),this.unsubscribe.push(G.subscribeKey("open",t=>{this.open=t,this.onOpen(!1)}))}disconnectedCallback(){this.unsubscribe.forEach(t=>t())}render(){const{message:t,variant:o}=G.state,r=tt[o];return c`
      <wui-alertbar
        message=${t}
        backgroundColor=${r?.backgroundColor}
        iconColor=${r?.iconColor}
        icon=${r?.icon}
        type=${o}
      ></wui-alertbar>
    `}onOpen(t){this.open?(this.animate([{opacity:0,transform:"scale(0.85)"},{opacity:1,transform:"scale(1)"}],{duration:150,fill:"forwards",easing:"ease"}),this.style.cssText="pointer-events: auto"):t||(this.animate([{opacity:1,transform:"scale(1)"},{opacity:0,transform:"scale(0.85)"}],{duration:150,fill:"forwards",easing:"ease"}),this.style.cssText="pointer-events: none")}};ue.styles=et;De([p()],ue.prototype,"open",void 0);ue=De([v("w3m-alertbar")],ue);const ot=T`
  button {
    background-color: transparent;
    padding: ${({spacing:e})=>e[1]};
  }

  button:focus-visible {
    box-shadow: 0 0 0 4px ${({tokens:e})=>e.core.foregroundAccent020};
  }

  button[data-variant='accent']:hover:enabled,
  button[data-variant='accent']:focus-visible {
    background-color: ${({tokens:e})=>e.core.foregroundAccent010};
  }

  button[data-variant='primary']:hover:enabled,
  button[data-variant='primary']:focus-visible,
  button[data-variant='secondary']:hover:enabled,
  button[data-variant='secondary']:focus-visible {
    background-color: ${({tokens:e})=>e.theme.foregroundSecondary};
  }

  button[data-size='xs'] > wui-icon {
    width: 8px;
    height: 8px;
  }

  button[data-size='sm'] > wui-icon {
    width: 12px;
    height: 12px;
  }

  button[data-size='xs'],
  button[data-size='sm'] {
    border-radius: ${({borderRadius:e})=>e[1]};
  }

  button[data-size='md'],
  button[data-size='lg'] {
    border-radius: ${({borderRadius:e})=>e[2]};
  }

  button[data-size='md'] > wui-icon {
    width: 16px;
    height: 16px;
  }

  button[data-size='lg'] > wui-icon {
    width: 20px;
    height: 20px;
  }

  button:disabled {
    background-color: transparent;
    cursor: not-allowed;
    opacity: 0.5;
  }

  button:hover:not(:disabled) {
    background-color: var(--wui-color-accent-glass-015);
  }

  button:focus-visible:not(:disabled) {
    background-color: var(--wui-color-accent-glass-015);
    box-shadow:
      inset 0 0 0 1px var(--wui-color-accent-100),
      0 0 0 4px var(--wui-color-accent-glass-020);
  }
`;var L=function(e,t,o,r){var a=arguments.length,n=a<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,o):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,o,r);else for(var l=e.length-1;l>=0;l--)(s=e[l])&&(n=(a<3?s(n):a>3?s(t,o,n):s(t,o))||n);return a>3&&n&&Object.defineProperty(t,o,n),n};let E=class extends k{constructor(){super(...arguments),this.size="md",this.disabled=!1,this.icon="copy",this.iconColor="default",this.variant="accent"}render(){const t={accent:"accent-primary",primary:"inverse",secondary:"default"};return c`
      <button data-variant=${this.variant} ?disabled=${this.disabled} data-size=${this.size}>
        <wui-icon
          color=${t[this.variant]||this.iconColor}
          size=${this.size}
          name=${this.icon}
        ></wui-icon>
      </button>
    `}};E.styles=[J,Ee,ot];L([m()],E.prototype,"size",void 0);L([m({type:Boolean})],E.prototype,"disabled",void 0);L([m()],E.prototype,"icon",void 0);L([m()],E.prototype,"iconColor",void 0);L([m()],E.prototype,"variant",void 0);E=L([v("wui-icon-link")],E);const nt=T`
  button {
    display: block;
    display: flex;
    align-items: center;
    padding: ${({spacing:e})=>e[1]};
    transition: background-color ${({durations:e})=>e.lg}
      ${({easings:e})=>e["ease-out-power-2"]};
    will-change: background-color;
    border-radius: ${({borderRadius:e})=>e[32]};
  }

  wui-image {
    border-radius: 100%;
  }

  wui-text {
    padding-left: ${({spacing:e})=>e[1]};
  }

  .left-icon-container,
  .right-icon-container {
    width: 24px;
    height: 24px;
    justify-content: center;
    align-items: center;
  }

  wui-icon {
    color: ${({tokens:e})=>e.theme.iconDefault};
  }

  /* -- Sizes --------------------------------------------------- */
  button[data-size='lg'] {
    height: 32px;
  }

  button[data-size='md'] {
    height: 28px;
  }

  button[data-size='sm'] {
    height: 24px;
  }

  button[data-size='lg'] wui-image {
    width: 24px;
    height: 24px;
  }

  button[data-size='md'] wui-image {
    width: 20px;
    height: 20px;
  }

  button[data-size='sm'] wui-image {
    width: 16px;
    height: 16px;
  }

  button[data-size='lg'] .left-icon-container {
    width: 24px;
    height: 24px;
  }

  button[data-size='md'] .left-icon-container {
    width: 20px;
    height: 20px;
  }

  button[data-size='sm'] .left-icon-container {
    width: 16px;
    height: 16px;
  }

  /* -- Variants --------------------------------------------------------- */
  button[data-type='filled-dropdown'] {
    background-color: ${({tokens:e})=>e.theme.foregroundPrimary};
  }

  button[data-type='text-dropdown'] {
    background-color: transparent;
  }

  /* -- Focus states --------------------------------------------------- */
  button:focus-visible:enabled {
    background-color: ${({tokens:e})=>e.theme.foregroundSecondary};
    box-shadow: 0 0 0 4px ${({tokens:e})=>e.core.foregroundAccent040};
  }

  /* -- Hover & Active states ----------------------------------------------------------- */
  @media (hover: hover) and (pointer: fine) {
    button:hover:enabled,
    button:active:enabled {
      background-color: ${({tokens:e})=>e.theme.foregroundSecondary};
    }
  }

  /* -- Disabled states --------------------------------------------------- */
  button:disabled {
    background-color: ${({tokens:e})=>e.theme.foregroundSecondary};
    opacity: 0.5;
  }
`;var M=function(e,t,o,r){var a=arguments.length,n=a<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,o):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,o,r);else for(var l=e.length-1;l>=0;l--)(s=e[l])&&(n=(a<3?s(n):a>3?s(t,o,n):s(t,o))||n);return a>3&&n&&Object.defineProperty(t,o,n),n};const it={lg:"lg-regular",md:"md-regular",sm:"sm-regular"},rt={lg:"lg",md:"md",sm:"sm"};let W=class extends k{constructor(){super(...arguments),this.imageSrc="",this.text="",this.size="lg",this.type="text-dropdown",this.disabled=!1}render(){return c`<button ?disabled=${this.disabled} data-size=${this.size} data-type=${this.type}>
      ${this.imageTemplate()} ${this.textTemplate()}
      <wui-flex class="right-icon-container">
        <wui-icon name="chevronBottom"></wui-icon>
      </wui-flex>
    </button>`}textTemplate(){const t=it[this.size];return this.text?c`<wui-text color="primary" variant=${t}>${this.text}</wui-text>`:null}imageTemplate(){if(this.imageSrc)return c`<wui-image src=${this.imageSrc} alt="select visual"></wui-image>`;const t=rt[this.size];return c` <wui-flex class="left-icon-container">
      <wui-icon size=${t} name="networkPlaceholder"></wui-icon>
    </wui-flex>`}};W.styles=[J,Ee,nt];M([m()],W.prototype,"imageSrc",void 0);M([m()],W.prototype,"text",void 0);M([m()],W.prototype,"size",void 0);M([m()],W.prototype,"type",void 0);M([m({type:Boolean})],W.prototype,"disabled",void 0);W=M([v("wui-select")],W);const at=T`
  :host {
    height: 60px;
  }

  :host > wui-flex {
    box-sizing: border-box;
    background-color: ${({tokens:e})=>e.theme.backgroundPrimary};
  }

  wui-text {
    background-color: ${({tokens:e})=>e.theme.backgroundPrimary};
  }

  wui-flex.w3m-header-title {
    transform: translateY(0);
    opacity: 1;
  }

  wui-flex.w3m-header-title[view-direction='prev'] {
    animation:
      slide-down-out 120ms forwards ${({easings:e})=>e["ease-out-power-2"]},
      slide-down-in 120ms forwards ${({easings:e})=>e["ease-out-power-2"]};
    animation-delay: 0ms, 200ms;
  }

  wui-flex.w3m-header-title[view-direction='next'] {
    animation:
      slide-up-out 120ms forwards ${({easings:e})=>e["ease-out-power-2"]},
      slide-up-in 120ms forwards ${({easings:e})=>e["ease-out-power-2"]};
    animation-delay: 0ms, 200ms;
  }

  wui-icon-link[data-hidden='true'] {
    opacity: 0 !important;
    pointer-events: none;
  }

  @keyframes slide-up-out {
    from {
      transform: translateY(0px);
      opacity: 1;
    }
    to {
      transform: translateY(3px);
      opacity: 0;
    }
  }

  @keyframes slide-up-in {
    from {
      transform: translateY(-3px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  @keyframes slide-down-out {
    from {
      transform: translateY(0px);
      opacity: 1;
    }
    to {
      transform: translateY(-3px);
      opacity: 0;
    }
  }

  @keyframes slide-down-in {
    from {
      transform: translateY(3px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
`;var R=function(e,t,o,r){var a=arguments.length,n=a<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,o):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,o,r);else for(var l=e.length-1;l>=0;l--)(s=e[l])&&(n=(a<3?s(n):a>3?s(t,o,n):s(t,o))||n);return a>3&&n&&Object.defineProperty(t,o,n),n};const st=["SmartSessionList"];function Te(){const e=u.state.data?.connector?.name,t=u.state.data?.wallet?.name,o=u.state.data?.network?.name,r=t??e,a=le.getConnectors();return{Connect:`Connect ${a.length===1&&a[0]?.id==="w3m-email"?"Email":""} Wallet`,Create:"Create Wallet",ChooseAccountName:void 0,Account:void 0,AccountSettings:void 0,AllWallets:"All Wallets",ApproveTransaction:"Approve Transaction",BuyInProgress:"Buy",ConnectingExternal:r??"Connect Wallet",ConnectingWalletConnect:r??"WalletConnect",ConnectingWalletConnectBasic:"WalletConnect",ConnectingSiwe:"Sign In",Convert:"Convert",ConvertSelectToken:"Select token",ConvertPreview:"Preview Convert",Downloads:r?`Get ${r}`:"Downloads",EmailLogin:"Email Login",EmailVerifyOtp:"Confirm Email",EmailVerifyDevice:"Register Device",GetWallet:"Get a Wallet",Networks:"Choose Network",OnRampProviders:"Choose Provider",OnRampActivity:"Activity",OnRampTokenSelect:"Select Token",OnRampFiatSelect:"Select Currency",Pay:"How you pay",ProfileWallets:"Wallets",SwitchNetwork:o??"Switch Network",Transactions:"Activity",UnsupportedChain:"Switch Network",UpgradeEmailWallet:"Upgrade Your Wallet",UpdateEmailWallet:"Edit Email",UpdateEmailPrimaryOtp:"Confirm Current Email",UpdateEmailSecondaryOtp:"Confirm New Email",WhatIsABuy:"What is Buy?",RegisterAccountName:"Choose Name",RegisterAccountNameSuccess:"",WalletReceive:"Receive",WalletCompatibleNetworks:"Compatible Networks",Swap:"Swap",SwapSelectToken:"Select Token",SwapPreview:"Preview Swap",WalletSend:"Send",WalletSendPreview:"Review Send",WalletSendSelectToken:"Select Token",WhatIsANetwork:"What is a network?",WhatIsAWallet:"What is a Wallet?",ConnectWallets:"Connect Wallet",ConnectSocials:"All Socials",ConnectingSocial:K.state.socialProvider?K.state.socialProvider.charAt(0).toUpperCase()+K.state.socialProvider.slice(1):"Connect Social",ConnectingMultiChain:"Select Chain",ConnectingFarcaster:"Farcaster",SwitchActiveChain:"Switch Chain",SmartSessionCreated:void 0,SmartSessionList:"Smart Sessions",SIWXSignMessage:"Sign In",PayLoading:"Payment in Progress",DataCapture:"Profile",DataCaptureOtpConfirm:"Confirm Email",FundWallet:"Fund Wallet",PayWithExchange:"Deposit from an Exchange",PayWithExchangeSelectAsset:"Select Asset"}}let $=class extends k{constructor(){super(),this.unsubscribe=[],this.heading=Te()[u.state.view],this.network=w.state.activeCaipNetwork,this.networkImage=me.getNetworkImage(this.network),this.showBack=!1,this.prevHistoryLength=1,this.view=u.state.view,this.viewDirection="",this.unsubscribe.push(He.subscribeNetworkImages(()=>{this.networkImage=me.getNetworkImage(this.network)}),u.subscribeKey("view",t=>{setTimeout(()=>{this.view=t,this.heading=Te()[t]},D.ANIMATION_DURATIONS.HeaderText),this.onViewChange(),this.onHistoryChange()}),w.subscribeKey("activeCaipNetwork",t=>{this.network=t,this.networkImage=me.getNetworkImage(this.network)}))}disconnectCallback(){this.unsubscribe.forEach(t=>t())}render(){return c`
      <wui-flex
        .padding=${["0","5","0","5"]}
        justifyContent="space-between"
        alignItems="center"
      >
        ${this.leftHeaderTemplate()} ${this.titleTemplate()} ${this.rightHeaderTemplate()}
      </wui-flex>
    `}onWalletHelp(){_.sendEvent({type:"track",event:"CLICK_WALLET_HELP"}),u.push("WhatIsAWallet")}async onClose(){await Oe.safeClose()}rightHeaderTemplate(){const t=b?.state?.features?.smartSessions;return u.state.view!=="Account"||!t?this.closeButtonTemplate():c`<wui-flex>
      <wui-icon-link
        icon="clock"
        variant="primary"
        @click=${()=>u.push("SmartSessionList")}
        data-testid="w3m-header-smart-sessions"
      ></wui-icon-link>
      ${this.closeButtonTemplate()}
    </wui-flex> `}closeButtonTemplate(){return c`
      <wui-icon-link
        icon="close"
        variant="primary"
        @click=${this.onClose.bind(this)}
        data-testid="w3m-header-close"
      ></wui-icon-link>
    `}titleTemplate(){const t=st.includes(this.view);return c`
      <wui-flex
        view-direction="${this.viewDirection}"
        class="w3m-header-title"
        alignItems="center"
        gap="2"
      >
        <wui-text variant="lg-regular" color="primary" data-testid="w3m-header-text">
          ${this.heading}
        </wui-text>
        ${t?c`<wui-tag variant="accent" size="md">Beta</wui-tag>`:null}
      </wui-flex>
    `}leftHeaderTemplate(){const{view:t}=u.state,o=t==="Connect",r=b.state.enableEmbedded,a=t==="ApproveTransaction",n=t==="ConnectingSiwe",s=t==="Account",l=b.state.enableNetworkSwitch,g=a||n||o&&r;return s&&l?c`<wui-select
        id="dynamic"
        data-testid="w3m-account-select-network"
        active-network=${de(this.network?.name)}
        @click=${this.onNetworks.bind(this)}
        imageSrc=${de(this.networkImage)}
      ></wui-select>`:this.showBack&&!g?c`<wui-icon-link
        data-testid="header-back"
        id="dynamic"
        icon="chevronLeft"
        variant="primary"
        @click=${this.onGoBack.bind(this)}
      ></wui-icon-link>`:c`<wui-icon-link
      data-hidden=${!o}
      id="dynamic"
      icon="helpCircle"
      variant="primary"
      @click=${this.onWalletHelp.bind(this)}
    ></wui-icon-link>`}onNetworks(){this.isAllowedNetworkSwitch()&&(_.sendEvent({type:"track",event:"CLICK_NETWORKS"}),u.push("Networks"))}isAllowedNetworkSwitch(){const t=w.getAllRequestedCaipNetworks(),o=t?t.length>1:!1,r=t?.find(({id:a})=>a===this.network?.id);return o||!r}onViewChange(){const{history:t}=u.state;let o=D.VIEW_DIRECTION.Next;t.length<this.prevHistoryLength&&(o=D.VIEW_DIRECTION.Prev),this.prevHistoryLength=t.length,this.viewDirection=o}async onHistoryChange(){const{history:t}=u.state,o=this.shadowRoot?.querySelector("#dynamic");t.length>1&&!this.showBack&&o?(await o.animate([{opacity:1},{opacity:0}],{duration:200,fill:"forwards",easing:"ease"}).finished,this.showBack=!0,o.animate([{opacity:0},{opacity:1}],{duration:200,fill:"forwards",easing:"ease"})):t.length<=1&&this.showBack&&o&&(await o.animate([{opacity:1},{opacity:0}],{duration:200,fill:"forwards",easing:"ease"}).finished,this.showBack=!1,o.animate([{opacity:0},{opacity:1}],{duration:200,fill:"forwards",easing:"ease"}))}onGoBack(){u.goBack()}};$.styles=at;R([p()],$.prototype,"heading",void 0);R([p()],$.prototype,"network",void 0);R([p()],$.prototype,"networkImage",void 0);R([p()],$.prototype,"showBack",void 0);R([p()],$.prototype,"prevHistoryLength",void 0);R([p()],$.prototype,"view",void 0);R([p()],$.prototype,"viewDirection",void 0);$=R([v("w3m-header")],$);const ct=T`
  :host {
    display: flex;
    align-items: center;
    gap: ${({spacing:e})=>e[1]};
    padding: ${({spacing:e})=>e[2]} ${({spacing:e})=>e[3]}
      ${({spacing:e})=>e[2]} ${({spacing:e})=>e[2]};
    border-radius: ${({borderRadius:e})=>e[20]};
    background-color: ${({tokens:e})=>e.theme.foregroundPrimary};
    box-shadow:
      0px 0px 8px 0px rgba(0, 0, 0, 0.1),
      inset 0 0 0 1px ${({tokens:e})=>e.theme.borderPrimary};
    max-width: 320px;
  }

  wui-icon-box {
    border-radius: ${({borderRadius:e})=>e.round} !important;
    overflow: hidden;
  }

  wui-loading-spinner {
    padding: ${({spacing:e})=>e[1]};
    background-color: ${({tokens:e})=>e.core.foregroundAccent010};
    border-radius: ${({borderRadius:e})=>e.round} !important;
  }
`;var be=function(e,t,o,r){var a=arguments.length,n=a<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,o):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,o,r);else for(var l=e.length-1;l>=0;l--)(s=e[l])&&(n=(a<3?s(n):a>3?s(t,o,n):s(t,o))||n);return a>3&&n&&Object.defineProperty(t,o,n),n};let q=class extends k{constructor(){super(...arguments),this.message="",this.variant="success"}render(){return c`
      ${this.templateIcon()}
      <wui-text variant="lg-regular" color="primary" data-testid="wui-snackbar-message"
        >${this.message}</wui-text
      >
    `}templateIcon(){const t={success:"success",error:"error",warning:"warning",info:"default"},o={success:"checkmark",error:"warning",warning:"warningCircle",info:"info"};return this.variant==="loading"?c`<wui-loading-spinner size="md" color="accent-primary"></wui-loading-spinner>`:c`<wui-icon-box
      size="md"
      color=${t[this.variant]}
      icon=${o[this.variant]}
    ></wui-icon-box>`}};q.styles=[J,ct];be([m()],q.prototype,"message",void 0);be([m()],q.prototype,"variant",void 0);q=be([v("wui-snackbar")],q);const lt=We`
  :host {
    display: block;
    position: absolute;
    opacity: 0;
    pointer-events: none;
    top: 11px;
    left: 50%;
    width: max-content;
  }
`;var _e=function(e,t,o,r){var a=arguments.length,n=a<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,o):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,o,r);else for(var l=e.length-1;l>=0;l--)(s=e[l])&&(n=(a<3?s(n):a>3?s(t,o,n):s(t,o))||n);return a>3&&n&&Object.defineProperty(t,o,n),n};let pe=class extends k{constructor(){super(),this.unsubscribe=[],this.timeout=void 0,this.open=f.state.open,this.unsubscribe.push(f.subscribeKey("open",t=>{this.open=t,this.onOpen()}))}disconnectedCallback(){clearTimeout(this.timeout),this.unsubscribe.forEach(t=>t())}render(){const{message:t,variant:o}=f.state;return c` <wui-snackbar message=${t} variant=${o}></wui-snackbar> `}onOpen(){clearTimeout(this.timeout),this.open?(this.animate([{opacity:0,transform:"translateX(-50%) scale(0.85)"},{opacity:1,transform:"translateX(-50%) scale(1)"}],{duration:150,fill:"forwards",easing:"ease"}),this.timeout&&clearTimeout(this.timeout),f.state.autoClose&&(this.timeout=setTimeout(()=>f.hide(),2500))):this.animate([{opacity:1,transform:"translateX(-50%) scale(1)"},{opacity:0,transform:"translateX(-50%) scale(0.85)"}],{duration:150,fill:"forwards",easing:"ease"})}};pe.styles=lt;_e([p()],pe.prototype,"open",void 0);pe=_e([v("w3m-snackbar")],pe);const dt=T`
  :host {
    pointer-events: none;
  }

  :host > wui-flex {
    display: var(--w3m-tooltip-display);
    opacity: var(--w3m-tooltip-opacity);
    padding: 9px ${({spacing:e})=>e[3]} 10px ${({spacing:e})=>e[3]};
    border-radius: ${({borderRadius:e})=>e[3]};
    color: ${({tokens:e})=>e.theme.backgroundPrimary};
    position: absolute;
    top: var(--w3m-tooltip-top);
    left: var(--w3m-tooltip-left);
    transform: translate(calc(-50% + var(--w3m-tooltip-parent-width)), calc(-100% - 8px));
    max-width: calc(var(--apkt-modal-width) - ${({spacing:e})=>e[5]});
    transition: opacity ${({durations:e})=>e.lg}
      ${({easings:e})=>e["ease-out-power-2"]};
    will-change: opacity;
    opacity: 0;
    animation-duration: ${({durations:e})=>e.xl};
    animation-timing-function: ${({easings:e})=>e["ease-out-power-2"]};
    animation-name: fade-in;
    animation-fill-mode: forwards;
  }

  :host([data-variant='shade']) > wui-flex {
    background-color: ${({tokens:e})=>e.theme.foregroundPrimary};
  }

  :host([data-variant='shade']) > wui-flex > wui-text {
    color: ${({tokens:e})=>e.theme.textSecondary};
  }

  :host([data-variant='fill']) > wui-flex {
    background-color: ${({tokens:e})=>e.theme.textPrimary};
    border: none;
  }

  wui-icon {
    position: absolute;
    width: 12px !important;
    height: 4px !important;
    color: ${({tokens:e})=>e.theme.foregroundPrimary};
  }

  wui-icon[data-placement='top'] {
    bottom: 0px;
    left: 50%;
    transform: translate(-50%, 95%);
  }

  wui-icon[data-placement='bottom'] {
    top: 0;
    left: 50%;
    transform: translate(-50%, -95%) rotate(180deg);
  }

  wui-icon[data-placement='right'] {
    top: 50%;
    left: 0;
    transform: translate(-65%, -50%) rotate(90deg);
  }

  wui-icon[data-placement='left'] {
    top: 50%;
    right: 0%;
    transform: translate(65%, -50%) rotate(270deg);
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`;var ee=function(e,t,o,r){var a=arguments.length,n=a<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,o):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,o,r);else for(var l=e.length-1;l>=0;l--)(s=e[l])&&(n=(a<3?s(n):a>3?s(t,o,n):s(t,o))||n);return a>3&&n&&Object.defineProperty(t,o,n),n};let B=class extends k{constructor(){super(),this.unsubscribe=[],this.open=V.state.open,this.message=V.state.message,this.triggerRect=V.state.triggerRect,this.variant=V.state.variant,this.unsubscribe.push(V.subscribe(t=>{this.open=t.open,this.message=t.message,this.triggerRect=t.triggerRect,this.variant=t.variant}))}disconnectedCallback(){this.unsubscribe.forEach(t=>t())}render(){this.dataset.variant=this.variant;const t=this.triggerRect.top,o=this.triggerRect.left;return this.style.cssText=`
    --w3m-tooltip-top: ${t}px;
    --w3m-tooltip-left: ${o}px;
    --w3m-tooltip-parent-width: ${this.triggerRect.width/2}px;
    --w3m-tooltip-display: ${this.open?"flex":"none"};
    --w3m-tooltip-opacity: ${this.open?1:0};
    `,c`<wui-flex>
      <wui-icon data-placement="top" size="inherit" name="cursor"></wui-icon>
      <wui-text color="primary" variant="sm-regular">${this.message}</wui-text>
    </wui-flex>`}};B.styles=[dt];ee([p()],B.prototype,"open",void 0);ee([p()],B.prototype,"message",void 0);ee([p()],B.prototype,"triggerRect",void 0);ee([p()],B.prototype,"variant",void 0);B=ee([v("w3m-tooltip")],B);const Y={getTabsByNamespace(e){return!!e&&e===A.CHAIN.EVM?b.state.remoteFeatures?.activity===!1?D.ACCOUNT_TABS.filter(o=>o.label!=="Activity"):D.ACCOUNT_TABS:[]},isValidReownName(e){return/^[a-zA-Z0-9]+$/gu.test(e)},isValidEmail(e){return/^[^\s@]+@[^\s@]+\.[^\s@]+$/gu.test(e)},validateReownName(e){return e.replace(/\^/gu,"").toLowerCase().replace(/[^a-zA-Z0-9]/gu,"")},hasFooter(){const e=u.state.view;if(D.VIEWS_WITH_LEGAL_FOOTER.includes(e)){const{termsConditionsUrl:t,privacyPolicyUrl:o}=b.state,r=b.state.features?.legalCheckbox;return!(!t&&!o||r)}return D.VIEWS_WITH_DEFAULT_FOOTER.includes(e)}},ut=T`
  :host wui-ux-by-reown {
    padding-top: 0;
  }

  :host wui-ux-by-reown.branding-only {
    padding-top: ${({spacing:e})=>e[3]};
  }

  a {
    text-decoration: none;
    color: ${({tokens:e})=>e.core.textAccentPrimary};
    font-weight: 500;
  }
`;var Be=function(e,t,o,r){var a=arguments.length,n=a<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,o):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,o,r);else for(var l=e.length-1;l>=0;l--)(s=e[l])&&(n=(a<3?s(n):a>3?s(t,o,n):s(t,o))||n);return a>3&&n&&Object.defineProperty(t,o,n),n};let we=class extends k{constructor(){super(),this.unsubscribe=[],this.remoteFeatures=b.state.remoteFeatures,this.unsubscribe.push(b.subscribeKey("remoteFeatures",t=>this.remoteFeatures=t))}disconnectedCallback(){this.unsubscribe.forEach(t=>t())}render(){const{termsConditionsUrl:t,privacyPolicyUrl:o}=b.state,r=b.state.features?.legalCheckbox;return!t&&!o||r?c`
        <wui-flex flexDirection="column"> ${this.reownBrandingTemplate(!0)} </wui-flex>
      `:c`
      <wui-flex flexDirection="column">
        <wui-flex .padding=${["4","3","3","3"]} justifyContent="center">
          <wui-text color="secondary" variant="md-regular" align="center">
            By connecting your wallet, you agree to our <br />
            ${this.termsTemplate()} ${this.andTemplate()} ${this.privacyTemplate()}
          </wui-text>
        </wui-flex>
        ${this.reownBrandingTemplate()}
      </wui-flex>
    `}andTemplate(){const{termsConditionsUrl:t,privacyPolicyUrl:o}=b.state;return t&&o?"and":""}termsTemplate(){const{termsConditionsUrl:t}=b.state;return t?c`<a href=${t} target="_blank" rel="noopener noreferrer"
      >Terms of Service</a
    >`:null}privacyTemplate(){const{privacyPolicyUrl:t}=b.state;return t?c`<a href=${t} target="_blank" rel="noopener noreferrer"
      >Privacy Policy</a
    >`:null}reownBrandingTemplate(t=!1){return this.remoteFeatures?.reownBranding?t?c`<wui-ux-by-reown class="branding-only"></wui-ux-by-reown>`:c`<wui-ux-by-reown></wui-ux-by-reown>`:null}};we.styles=[ut];Be([p()],we.prototype,"remoteFeatures",void 0);we=Be([v("w3m-legal-footer")],we);const pt=We``;var wt=function(e,t,o,r){var a=arguments.length,n=a<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,o):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,o,r);else for(var l=e.length-1;l>=0;l--)(s=e[l])&&(n=(a<3?s(n):a>3?s(t,o,n):s(t,o))||n);return a>3&&n&&Object.defineProperty(t,o,n),n};let fe=class extends k{render(){const{termsConditionsUrl:t,privacyPolicyUrl:o}=b.state;return!t&&!o?null:c`
      <wui-flex
        .padding=${["4","3","3","3"]}
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        gap="3"
      >
        <wui-text color="secondary" variant="md-regular" align="center">
          We work with the best providers to give you the lowest fees and best support. More options
          coming soon!
        </wui-text>

        ${this.howDoesItWorkTemplate()}
      </wui-flex>
    `}howDoesItWorkTemplate(){return c` <wui-link @click=${this.onWhatIsBuy.bind(this)}>
      <wui-icon size="xs" color="accent-primary" slot="iconLeft" name="helpCircle"></wui-icon>
      How does it work?
    </wui-link>`}onWhatIsBuy(){_.sendEvent({type:"track",event:"SELECT_WHAT_IS_A_BUY",properties:{isSmartAccount:ie(w.state.activeChain)===re.ACCOUNT_TYPES.SMART_ACCOUNT}}),u.push("WhatIsABuy")}};fe.styles=[pt];fe=wt([v("w3m-onramp-providers-footer")],fe);const mt=T`
  :host {
    display: block;
  }

  div.container {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    overflow: hidden;
    height: auto;
    display: block;
  }

  div.container[status='hide'] {
    animation: fade-out;
    animation-duration: var(--apkt-duration-dynamic);
    animation-timing-function: ${({easings:e})=>e["ease-out-power-2"]};
    animation-fill-mode: both;
    animation-delay: 0s;
  }

  div.container[status='show'] {
    animation: fade-in;
    animation-duration: var(--apkt-duration-dynamic);
    animation-timing-function: ${({easings:e})=>e["ease-out-power-2"]};
    animation-fill-mode: both;
    animation-delay: var(--apkt-duration-dynamic);
  }

  @keyframes fade-in {
    from {
      opacity: 0;
      filter: blur(6px);
    }
    to {
      opacity: 1;
      filter: blur(0px);
    }
  }

  @keyframes fade-out {
    from {
      opacity: 1;
      filter: blur(0px);
    }
    to {
      opacity: 0;
      filter: blur(6px);
    }
  }
`;var ve=function(e,t,o,r){var a=arguments.length,n=a<3?t:r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,o,r);else for(var l=e.length-1;l>=0;l--)(s=e[l])&&(n=(a<3?s(n):a>3?s(t,o,n):s(t,o))||n);return a>3&&n&&Object.defineProperty(t,o,n),n};let Q=class extends k{constructor(){super(...arguments),this.resizeObserver=void 0,this.unsubscribe=[],this.status="hide",this.view=u.state.view}firstUpdated(){this.status=Y.hasFooter()?"show":"hide",this.unsubscribe.push(u.subscribeKey("view",t=>{this.view=t,this.status=Y.hasFooter()?"show":"hide",this.status==="hide"&&document.documentElement.style.setProperty("--apkt-footer-height","0px")})),this.resizeObserver=new ResizeObserver(t=>{for(const o of t)if(o.target===this.getWrapper()){const r=`${o.contentRect.height}px`;document.documentElement.style.setProperty("--apkt-footer-height",r)}}),this.resizeObserver.observe(this.getWrapper())}render(){return c`
      <div class="container" status=${this.status}>${this.templatePageContainer()}</div>
    `}templatePageContainer(){return Y.hasFooter()?c` ${this.templateFooter()}`:null}templateFooter(){switch(this.view){case"Networks":return this.templateNetworksFooter();case"Connect":case"ConnectWallets":case"OnRampFiatSelect":case"OnRampTokenSelect":return c`<w3m-legal-footer></w3m-legal-footer>`;case"OnRampProviders":return c`<w3m-onramp-providers-footer></w3m-onramp-providers-footer>`;default:return null}}templateNetworksFooter(){return c` <wui-flex
      class="footer-in"
      padding="3"
      flexDirection="column"
      gap="3"
      alignItems="center"
    >
      <wui-text variant="md-regular" color="secondary" align="center">
        Your connected wallet may not support some of the networks available for this dApp
      </wui-text>
      <wui-link @click=${this.onNetworkHelp.bind(this)}>
        <wui-icon size="sm" color="accent-primary" slot="iconLeft" name="helpCircle"></wui-icon>
        What is a network
      </wui-link>
    </wui-flex>`}onNetworkHelp(){_.sendEvent({type:"track",event:"CLICK_NETWORK_HELP"}),u.push("WhatIsANetwork")}getWrapper(){return this.shadowRoot?.querySelector("div.container")}};Q.styles=[mt];ve([p()],Q.prototype,"status",void 0);ve([p()],Q.prototype,"view",void 0);Q=ve([v("w3m-footer")],Q);const ht=T`
  :host {
    display: block;
    width: inherit;
  }
`;var ye=function(e,t,o,r){var a=arguments.length,n=a<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,o):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,o,r);else for(var l=e.length-1;l>=0;l--)(s=e[l])&&(n=(a<3?s(n):a>3?s(t,o,n):s(t,o))||n);return a>3&&n&&Object.defineProperty(t,o,n),n};let Z=class extends k{constructor(){super(),this.unsubscribe=[],this.viewState=u.state.view,this.history=u.state.history.join(","),this.unsubscribe.push(u.subscribeKey("view",()=>{this.history=u.state.history.join(","),document.documentElement.style.setProperty("--apkt-duration-dynamic","var(--apkt-durations-lg)")}))}disconnectedCallback(){this.unsubscribe.forEach(t=>t()),document.documentElement.style.setProperty("--apkt-duration-dynamic","0s")}render(){return c`${this.templatePageContainer()}`}templatePageContainer(){return c`<w3m-router-container
      history=${this.history}
      .setView=${()=>{this.viewState=u.state.view}}
    >
      ${this.viewTemplate(this.viewState)}
    </w3m-router-container>`}viewTemplate(t){switch(t){case"AccountSettings":return c`<w3m-account-settings-view></w3m-account-settings-view>`;case"Account":return c`<w3m-account-view></w3m-account-view>`;case"AllWallets":return c`<w3m-all-wallets-view></w3m-all-wallets-view>`;case"ApproveTransaction":return c`<w3m-approve-transaction-view></w3m-approve-transaction-view>`;case"BuyInProgress":return c`<w3m-buy-in-progress-view></w3m-buy-in-progress-view>`;case"ChooseAccountName":return c`<w3m-choose-account-name-view></w3m-choose-account-name-view>`;case"Connect":return c`<w3m-connect-view></w3m-connect-view>`;case"Create":return c`<w3m-connect-view walletGuide="explore"></w3m-connect-view>`;case"ConnectingWalletConnect":return c`<w3m-connecting-wc-view></w3m-connecting-wc-view>`;case"ConnectingWalletConnectBasic":return c`<w3m-connecting-wc-basic-view></w3m-connecting-wc-basic-view>`;case"ConnectingExternal":return c`<w3m-connecting-external-view></w3m-connecting-external-view>`;case"ConnectingSiwe":return c`<w3m-connecting-siwe-view></w3m-connecting-siwe-view>`;case"ConnectWallets":return c`<w3m-connect-wallets-view></w3m-connect-wallets-view>`;case"ConnectSocials":return c`<w3m-connect-socials-view></w3m-connect-socials-view>`;case"ConnectingSocial":return c`<w3m-connecting-social-view></w3m-connecting-social-view>`;case"DataCapture":return c`<w3m-data-capture-view></w3m-data-capture-view>`;case"DataCaptureOtpConfirm":return c`<w3m-data-capture-otp-confirm-view></w3m-data-capture-otp-confirm-view>`;case"Downloads":return c`<w3m-downloads-view></w3m-downloads-view>`;case"EmailLogin":return c`<w3m-email-login-view></w3m-email-login-view>`;case"EmailVerifyOtp":return c`<w3m-email-verify-otp-view></w3m-email-verify-otp-view>`;case"EmailVerifyDevice":return c`<w3m-email-verify-device-view></w3m-email-verify-device-view>`;case"GetWallet":return c`<w3m-get-wallet-view></w3m-get-wallet-view>`;case"Networks":return c`<w3m-networks-view></w3m-networks-view>`;case"SwitchNetwork":return c`<w3m-network-switch-view></w3m-network-switch-view>`;case"ProfileWallets":return c`<w3m-profile-wallets-view></w3m-profile-wallets-view>`;case"Transactions":return c`<w3m-transactions-view></w3m-transactions-view>`;case"OnRampProviders":return c`<w3m-onramp-providers-view></w3m-onramp-providers-view>`;case"OnRampTokenSelect":return c`<w3m-onramp-token-select-view></w3m-onramp-token-select-view>`;case"OnRampFiatSelect":return c`<w3m-onramp-fiat-select-view></w3m-onramp-fiat-select-view>`;case"UpgradeEmailWallet":return c`<w3m-upgrade-wallet-view></w3m-upgrade-wallet-view>`;case"UpdateEmailWallet":return c`<w3m-update-email-wallet-view></w3m-update-email-wallet-view>`;case"UpdateEmailPrimaryOtp":return c`<w3m-update-email-primary-otp-view></w3m-update-email-primary-otp-view>`;case"UpdateEmailSecondaryOtp":return c`<w3m-update-email-secondary-otp-view></w3m-update-email-secondary-otp-view>`;case"UnsupportedChain":return c`<w3m-unsupported-chain-view></w3m-unsupported-chain-view>`;case"Swap":return c`<w3m-swap-view></w3m-swap-view>`;case"SwapSelectToken":return c`<w3m-swap-select-token-view></w3m-swap-select-token-view>`;case"SwapPreview":return c`<w3m-swap-preview-view></w3m-swap-preview-view>`;case"WalletSend":return c`<w3m-wallet-send-view></w3m-wallet-send-view>`;case"WalletSendSelectToken":return c`<w3m-wallet-send-select-token-view></w3m-wallet-send-select-token-view>`;case"WalletSendPreview":return c`<w3m-wallet-send-preview-view></w3m-wallet-send-preview-view>`;case"WhatIsABuy":return c`<w3m-what-is-a-buy-view></w3m-what-is-a-buy-view>`;case"WalletReceive":return c`<w3m-wallet-receive-view></w3m-wallet-receive-view>`;case"WalletCompatibleNetworks":return c`<w3m-wallet-compatible-networks-view></w3m-wallet-compatible-networks-view>`;case"WhatIsAWallet":return c`<w3m-what-is-a-wallet-view></w3m-what-is-a-wallet-view>`;case"ConnectingMultiChain":return c`<w3m-connecting-multi-chain-view></w3m-connecting-multi-chain-view>`;case"WhatIsANetwork":return c`<w3m-what-is-a-network-view></w3m-what-is-a-network-view>`;case"ConnectingFarcaster":return c`<w3m-connecting-farcaster-view></w3m-connecting-farcaster-view>`;case"SwitchActiveChain":return c`<w3m-switch-active-chain-view></w3m-switch-active-chain-view>`;case"RegisterAccountName":return c`<w3m-register-account-name-view></w3m-register-account-name-view>`;case"RegisterAccountNameSuccess":return c`<w3m-register-account-name-success-view></w3m-register-account-name-success-view>`;case"SmartSessionCreated":return c`<w3m-smart-session-created-view></w3m-smart-session-created-view>`;case"SmartSessionList":return c`<w3m-smart-session-list-view></w3m-smart-session-list-view>`;case"SIWXSignMessage":return c`<w3m-siwx-sign-message-view></w3m-siwx-sign-message-view>`;case"Pay":return c`<w3m-pay-view></w3m-pay-view>`;case"PayLoading":return c`<w3m-pay-loading-view></w3m-pay-loading-view>`;case"FundWallet":return c`<w3m-fund-wallet-view></w3m-fund-wallet-view>`;case"PayWithExchange":return c`<w3m-deposit-from-exchange-view></w3m-deposit-from-exchange-view>`;case"PayWithExchangeSelectAsset":return c`<w3m-deposit-from-exchange-select-asset-view></w3m-deposit-from-exchange-select-asset-view>`;default:return c`<w3m-connect-view></w3m-connect-view>`}}};Z.styles=[ht];ye([p()],Z.prototype,"viewState",void 0);ye([p()],Z.prototype,"history",void 0);Z=ye([v("w3m-router")],Z);const ft=T`
  :host {
    z-index: var(--w3m-z-index);
    display: block;
    backface-visibility: hidden;
    will-change: opacity;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    opacity: 0;
    background-color: ${({tokens:e})=>e.theme.overlay};
    backdrop-filter: blur(0px);
    transition:
      opacity ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-2"]},
      backdrop-filter ${({durations:e})=>e.lg}
        ${({easings:e})=>e["ease-out-power-2"]};
    will-change: opacity;
  }

  :host(.open) {
    opacity: 1;
    backdrop-filter: blur(8px);
  }

  :host(.appkit-modal) {
    position: relative;
    pointer-events: unset;
    background: none;
    width: 100%;
    opacity: 1;
  }

  wui-card {
    max-width: var(--apkt-modal-width);
    width: 100%;
    position: relative;
    outline: none;
    transform: translateY(4px);
    box-shadow: 0 2px 8px 0 rgba(0, 0, 0, 0.05);
    transition:
      transform ${({durations:e})=>e.lg}
        ${({easings:e})=>e["ease-out-power-2"]},
      border-radius ${({durations:e})=>e.lg}
        ${({easings:e})=>e["ease-out-power-1"]},
      background-color ${({durations:e})=>e.lg}
        ${({easings:e})=>e["ease-out-power-1"]},
      box-shadow ${({durations:e})=>e.lg}
        ${({easings:e})=>e["ease-out-power-1"]};
    will-change: border-radius, background-color, transform, box-shadow;
    background-color: ${({tokens:e})=>e.theme.backgroundPrimary};
    padding: ${({spacing:e})=>e[1]};
    box-sizing: border-box;
  }

  :host(.open) wui-card {
    transform: translateY(0px);
  }

  wui-card::before {
    z-index: 1;
    pointer-events: none;
    content: '';
    position: absolute;
    inset: 0;
    border-radius: clamp(0px, var(--apkt-borderRadius-8), 44px);
    transition: box-shadow ${({durations:e})=>e.lg}
      ${({easings:e})=>e["ease-out-power-2"]};
    transition-delay: ${({durations:e})=>e.md};
    will-change: box-shadow;
  }

  :host([data-border='true']) wui-card::before {
    box-shadow: inset 0px 0px 0px 4px ${({tokens:e})=>e.theme.foregroundSecondary};
  }

  :host([data-border='false']) wui-card::before {
    box-shadow: inset 0px 0px 0px 1px ${({tokens:e})=>e.theme.borderPrimaryDark};
  }

  :host([data-border='true']) wui-card {
    animation:
      fade-in ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-2"]},
      card-background-border var(--apkt-duration-dynamic)
        ${({easings:e})=>e["ease-out-power-2"]};
    animation-fill-mode: backwards, both;
    animation-delay: var(--apkt-duration-dynamic);
  }

  :host([data-border='false']) wui-card {
    animation:
      fade-in ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-2"]},
      card-background-default var(--apkt-duration-dynamic)
        ${({easings:e})=>e["ease-out-power-2"]};
    animation-fill-mode: backwards, both;
    animation-delay: 0s;
  }

  :host(.appkit-modal) wui-card {
    max-width: 400px;
  }

  wui-card[shake='true'] {
    animation:
      fade-in ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-2"]},
      w3m-shake ${({durations:e})=>e.xl}
        ${({easings:e})=>e["ease-out-power-2"]};
  }

  wui-flex {
    overflow-x: hidden;
    overflow-y: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  @media (max-height: 700px) and (min-width: 431px) {
    wui-flex {
      align-items: flex-start;
    }

    wui-card {
      margin: var(--apkt-spacing-6) 0px;
    }
  }

  @media (max-width: 430px) {
    wui-flex {
      align-items: flex-end;
    }

    wui-card {
      max-width: 100%;
      border-bottom-left-radius: var(--local-border-bottom-mobile-radius);
      border-bottom-right-radius: var(--local-border-bottom-mobile-radius);
      border-bottom: none;
    }

    wui-card[shake='true'] {
      animation: w3m-shake 0.5s ${({easings:e})=>e["ease-out-power-2"]};
    }
  }

  @keyframes fade-in {
    0% {
      transform: scale(0.99) translateY(4px);
    }
    100% {
      transform: scale(1) translateY(0);
    }
  }

  @keyframes w3m-shake {
    0% {
      transform: scale(1) rotate(0deg);
    }
    20% {
      transform: scale(1) rotate(-1deg);
    }
    40% {
      transform: scale(1) rotate(1.5deg);
    }
    60% {
      transform: scale(1) rotate(-1.5deg);
    }
    80% {
      transform: scale(1) rotate(1deg);
    }
    100% {
      transform: scale(1) rotate(0deg);
    }
  }

  @keyframes card-background-border {
    from {
      background-color: ${({tokens:e})=>e.theme.backgroundPrimary};
    }
    to {
      background-color: ${({tokens:e})=>e.theme.foregroundSecondary};
    }
  }

  @keyframes card-background-default {
    from {
      background-color: ${({tokens:e})=>e.theme.foregroundSecondary};
    }
    to {
      background-color: ${({tokens:e})=>e.theme.backgroundPrimary};
    }
  }
`;var O=function(e,t,o,r){var a=arguments.length,n=a<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,o):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,o,r);else for(var l=e.length-1;l>=0;l--)(s=e[l])&&(n=(a<3?s(n):a>3?s(t,o,n):s(t,o))||n);return a>3&&n&&Object.defineProperty(t,o,n),n};const xe="scroll-lock";class P extends k{constructor(){super(),this.unsubscribe=[],this.abortController=void 0,this.hasPrefetched=!1,this.enableEmbedded=b.state.enableEmbedded,this.open=S.state.open,this.caipAddress=w.state.activeCaipAddress,this.caipNetwork=w.state.activeCaipNetwork,this.shake=S.state.shake,this.filterByNamespace=le.state.filterByNamespace,this.initializeTheming(),oe.prefetchAnalyticsConfig(),this.unsubscribe.push(S.subscribeKey("open",t=>t?this.onOpen():this.onClose()),S.subscribeKey("shake",t=>this.shake=t),w.subscribeKey("activeCaipNetwork",t=>this.onNewNetwork(t)),w.subscribeKey("activeCaipAddress",t=>this.onNewAddress(t)),b.subscribeKey("enableEmbedded",t=>this.enableEmbedded=t),le.subscribeKey("filterByNamespace",t=>{this.filterByNamespace!==t&&!w.getAccountData(t)?.caipAddress&&(oe.fetchRecommendedWallets(),this.filterByNamespace=t)}),u.subscribeKey("view",()=>{this.dataset.border=Y.hasFooter()?"true":"false"}))}firstUpdated(){if(this.dataset.border=Y.hasFooter()?"true":"false",this.caipAddress){if(this.enableEmbedded){S.close(),this.prefetch();return}this.onNewAddress(this.caipAddress)}this.open&&this.onOpen(),this.enableEmbedded&&this.prefetch()}disconnectedCallback(){this.unsubscribe.forEach(t=>t()),this.onRemoveKeyboardListener()}render(){return this.style.cssText=`
      --local-border-bottom-mobile-radius: ${this.enableEmbedded?"clamp(0px, var(--apkt-borderRadius-8), 44px)":"0px"};
    `,this.enableEmbedded?c`${this.contentTemplate()}
        <w3m-tooltip></w3m-tooltip> `:this.open?c`
          <wui-flex @click=${this.onOverlayClick.bind(this)} data-testid="w3m-modal-overlay">
            ${this.contentTemplate()}
          </wui-flex>
          <w3m-tooltip></w3m-tooltip>
        `:null}contentTemplate(){return c` <wui-card
      shake="${this.shake}"
      data-embedded="${de(this.enableEmbedded)}"
      role="alertdialog"
      aria-modal="true"
      tabindex="0"
      data-testid="w3m-modal-card"
    >
      <w3m-header></w3m-header>
      <w3m-router></w3m-router>
      <w3m-footer></w3m-footer>
      <w3m-snackbar></w3m-snackbar>
      <w3m-alertbar></w3m-alertbar>
    </wui-card>`}async onOverlayClick(t){t.target===t.currentTarget&&await this.handleClose()}async handleClose(){await Oe.safeClose()}initializeTheming(){const{themeVariables:t,themeMode:o}=Ve.state,r=Re.getColorTheme(o);Ke(t,r)}onClose(){this.open=!1,this.classList.remove("open"),this.onScrollUnlock(),f.hide(),this.onRemoveKeyboardListener()}onOpen(){this.open=!0,this.classList.add("open"),this.onScrollLock(),this.onAddKeyboardListener()}onScrollLock(){const t=document.createElement("style");t.dataset.w3m=xe,t.textContent=`
      body {
        touch-action: none;
        overflow: hidden;
        overscroll-behavior: contain;
      }
      w3m-modal {
        pointer-events: auto;
      }
    `,document.head.appendChild(t)}onScrollUnlock(){const t=document.head.querySelector(`style[data-w3m="${xe}"]`);t&&t.remove()}onAddKeyboardListener(){this.abortController=new AbortController;const t=this.shadowRoot?.querySelector("wui-card");t?.focus(),window.addEventListener("keydown",o=>{if(o.key==="Escape")this.handleClose();else if(o.key==="Tab"){const{tagName:r}=o.target;r&&!r.includes("W3M-")&&!r.includes("WUI-")&&t?.focus()}},this.abortController)}onRemoveKeyboardListener(){this.abortController?.abort(),this.abortController=void 0}async onNewAddress(t){const o=w.state.isSwitchingNamespace,r=u.state.view==="ProfileWallets";t?await this.onConnected({caipAddress:t,isSwitchingNamespace:o,isInProfileView:r}):!o&&!this.enableEmbedded&&!r&&S.close(),await se.initializeIfEnabled(t),this.caipAddress=t,w.setIsSwitchingNamespace(!1)}async onConnected(t){if(t.isInProfileView)return;const{chainNamespace:o,chainId:r,address:a}=Ge.parseCaipAddress(t.caipAddress),n=`${o}:${r}`,s=!ae.getPlainAddress(this.caipAddress),l=await se.getSessions({address:a,caipNetworkId:n}),g=se.getSIWX()?l.some(F=>F.data.accountAddress===a):!0,U=t.isSwitchingNamespace&&g&&!this.enableEmbedded,z=this.enableEmbedded&&s;U?u.goBack():z&&S.close()}onNewNetwork(t){const o=this.caipNetwork,r=o?.caipNetworkId?.toString(),a=o?.chainNamespace,n=t?.caipNetworkId?.toString(),s=t?.chainNamespace,l=r!==n,U=l&&!(a!==s),z=o?.name===A.UNSUPPORTED_NETWORK_NAME,F=u.state.view==="ConnectingExternal",Ue=u.state.view==="ProfileWallets",ze=!w.getAccountData(t?.chainNamespace)?.caipAddress,Fe=u.state.view==="UnsupportedChain",Le=S.state.open;let j=!1;this.enableEmbedded&&u.state.view==="SwitchNetwork"&&(j=!0),l&&d.resetState(),Le&&!F&&!Ue&&(ze?l&&(j=!0):(Fe||U&&!z)&&(j=!0)),j&&u.state.view!=="SIWXSignMessage"&&u.goBack(),this.caipNetwork=t}prefetch(){this.hasPrefetched||(oe.prefetch(),oe.fetchWalletsByPage({page:1}),this.hasPrefetched=!0)}}P.styles=ft;O([m({type:Boolean})],P.prototype,"enableEmbedded",void 0);O([p()],P.prototype,"open",void 0);O([p()],P.prototype,"caipAddress",void 0);O([p()],P.prototype,"caipNetwork",void 0);O([p()],P.prototype,"shake",void 0);O([p()],P.prototype,"filterByNamespace",void 0);let Se=class extends P{};Se=O([v("w3m-modal")],Se);let Ce=class extends P{};Ce=O([v("appkit-modal")],Ce);const gt=T`
  :host {
    --local-duration-height: 0s;
    --local-duration: ${({durations:e})=>e.lg};
    --local-transition: ${({easings:e})=>e["ease-out-power-2"]};
  }

  .container {
    display: block;
    overflow: hidden;
    overflow: hidden;
    position: relative;
    height: var(--local-container-height);
    transition: height var(--local-duration-height) var(--local-transition);
    will-change: height, padding-bottom;
  }

  .page {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    width: 100%;
    height: auto;
    width: inherit;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    background-color: ${({tokens:e})=>e.theme.backgroundPrimary};
    border-bottom-left-radius: var(--local-border-bottom-radius);
    border-bottom-right-radius: var(--local-border-bottom-radius);
    transition: border-bottom-left-radius var(--local-duration) var(--local-transition);
  }

  .footer {
    height: var(--apkt-footer-height);
  }

  div.page[view-direction^='prev-'] .page-content {
    animation:
      slide-left-out var(--local-duration) forwards var(--local-transition),
      slide-left-in var(--local-duration) forwards var(--local-transition);
    animation-delay: 0ms, var(--local-duration, ${({durations:e})=>e.lg});
  }

  div.page[view-direction^='next-'] .page-content {
    animation:
      slide-right-out var(--local-duration) forwards var(--local-transition),
      slide-right-in var(--local-duration) forwards var(--local-transition);
    animation-delay: 0ms, var(--local-duration, ${({durations:e})=>e.lg});
  }

  @keyframes slide-left-out {
    from {
      transform: translateX(0px) scale(1);
      opacity: 1;
      filter: blur(0px);
    }
    to {
      transform: translateX(8px) scale(0.99);
      opacity: 0;
      filter: blur(4px);
    }
  }

  @keyframes slide-left-in {
    from {
      transform: translateX(-8px) scale(0.99);
      opacity: 0;
      filter: blur(4px);
    }
    to {
      transform: translateX(0) translateY(0) scale(1);
      opacity: 1;
      filter: blur(0px);
    }
  }

  @keyframes slide-right-out {
    from {
      transform: translateX(0px) scale(1);
      opacity: 1;
      filter: blur(0px);
    }
    to {
      transform: translateX(-8px) scale(0.99);
      opacity: 0;
      filter: blur(4px);
    }
  }

  @keyframes slide-right-in {
    from {
      transform: translateX(8px) scale(0.99);
      opacity: 0;
      filter: blur(4px);
    }
    to {
      transform: translateX(0) translateY(0) scale(1);
      opacity: 1;
      filter: blur(0px);
    }
  }
`;var I=function(e,t,o,r){var a=arguments.length,n=a<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,o):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(e,t,o,r);else for(var l=e.length-1;l>=0;l--)(s=e[l])&&(n=(a<3?s(n):a>3?s(t,o,n):s(t,o))||n);return a>3&&n&&Object.defineProperty(t,o,n),n};let C=class extends k{constructor(){super(...arguments),this.resizeObserver=void 0,this.transitionDuration="0.15s",this.transitionFunction="",this.history="",this.view="",this.setView=void 0,this.viewDirection="",this.historyState="",this.previousHeight="0px"}updated(t){if(t.has("history")){const o=this.history;this.historyState!==""&&this.historyState!==o&&this.onViewChange(o)}t.has("transitionDuration")&&this.style.setProperty("--local-duration",this.transitionDuration),t.has("transitionFunction")&&this.style.setProperty("--local-transition",this.transitionFunction)}firstUpdated(){this.transitionFunction&&this.style.setProperty("--local-transition",this.transitionFunction),this.style.setProperty("--local-duration",this.transitionDuration),this.historyState=this.history,this.resizeObserver=new ResizeObserver(t=>{for(const o of t)if(o.target===this.getWrapper()){let r=o.contentRect.height;const a=parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--apkt-footer-height")||"0");r=r+a,this.style.setProperty("--local-border-bottom-radius",a?"var(--apkt-borderRadius-5)":"0px"),this.style.setProperty("--local-container-height",`${r}px`),this.previousHeight!=="0px"&&this.style.setProperty("--local-duration-height",this.transitionDuration),this.previousHeight=`${r}px`}}),this.resizeObserver.observe(this.getWrapper())}disconnectedCallback(){const t=this.getWrapper();t&&this.resizeObserver&&this.resizeObserver.unobserve(t)}render(){return c`
      <div class="container">
        <div class="page" view-direction="${this.viewDirection}">
          <div class="page-content">
            <slot></slot>
          </div>
        </div>
      </div>
    `}onViewChange(t){const o=t.split(",").filter(Boolean),r=this.historyState.split(",").filter(Boolean),a=r.length,n=o.length,s=o[o.length-1]||"",l=Re.cssDurationToNumber(this.transitionDuration);let g="";n>a?g="next":n<a?g="prev":n===a&&o[n-1]!==r[a-1]&&(g="next"),this.viewDirection=`${g}-${s}`,setTimeout(()=>{this.historyState=t,this.setView?.(s)},l),setTimeout(()=>{this.viewDirection=""},l*2)}getWrapper(){return this.shadowRoot?.querySelector("div.page")}};C.styles=[gt];I([m({type:String})],C.prototype,"transitionDuration",void 0);I([m({type:String})],C.prototype,"transitionFunction",void 0);I([m({type:String})],C.prototype,"history",void 0);I([m({type:String})],C.prototype,"view",void 0);I([m({attribute:!1})],C.prototype,"setView",void 0);I([p()],C.prototype,"viewDirection",void 0);I([p()],C.prototype,"historyState",void 0);I([p()],C.prototype,"previousHeight",void 0);C=I([v("w3m-router-container")],C);export{Ce as AppKitModal,Se as W3mModal,P as W3mModalBase,C as W3mRouterContainer};
