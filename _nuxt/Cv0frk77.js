import{n as h,Y as l,t as o,p,O as V,s as f}from"./BhbIh-14.js";(function(){try{var t=typeof window<"u"?window:typeof global<"u"?global:typeof self<"u"?self:{},a=new t.Error().stack;a&&(t._sentryDebugIds=t._sentryDebugIds||{},t._sentryDebugIds[a]="f03083f8-c335-4de9-90ec-022a1f25995d",t._sentryDebugIdIdentifier="sentry-dbid-f03083f8-c335-4de9-90ec-022a1f25995d")}catch{}})();var c=Object.defineProperty,g=Object.getOwnPropertyDescriptor,s=(t,a,H,i)=>{for(var r=i>1?void 0:i?g(a,H):a,n=t.length-1,d;n>=0;n--)(d=t[n])&&(r=(i?d(a,H,r):d(r))||r);return i&&r&&c(a,H,r),r};let e=class extends h{constructor(){super(...arguments),this.size="1em",this.weight="regular",this.color="currentColor",this.mirrored=!1}render(){var t;return l`<svg
      xmlns="http://www.w3.org/2000/svg"
      width="${this.size}"
      height="${this.size}"
      fill="${this.color}"
      viewBox="0 0 256 256"
      transform=${this.mirrored?"scale(-1, 1)":null}
    >
      ${e.weightsMap.get((t=this.weight)!=null?t:"regular")}
    </svg>`}};e.weightsMap=new Map([["thin",o`<path d="M216,36H88a4,4,0,0,0-4,4V84H40a4,4,0,0,0-4,4V216a4,4,0,0,0,4,4H168a4,4,0,0,0,4-4V172h44a4,4,0,0,0,4-4V40A4,4,0,0,0,216,36ZM164,212H44V92H164Zm48-48H172V88a4,4,0,0,0-4-4H92V44H212Z"/>`],["light",o`<path d="M216,34H88a6,6,0,0,0-6,6V82H40a6,6,0,0,0-6,6V216a6,6,0,0,0,6,6H168a6,6,0,0,0,6-6V174h42a6,6,0,0,0,6-6V40A6,6,0,0,0,216,34ZM162,210H46V94H162Zm48-48H174V88a6,6,0,0,0-6-6H94V46H210Z"/>`],["regular",o`<path d="M216,32H88a8,8,0,0,0-8,8V80H40a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8H168a8,8,0,0,0,8-8V176h40a8,8,0,0,0,8-8V40A8,8,0,0,0,216,32ZM160,208H48V96H160Zm48-48H176V88a8,8,0,0,0-8-8H96V48H208Z"/>`],["bold",o`<path d="M216,28H88A12,12,0,0,0,76,40V76H40A12,12,0,0,0,28,88V216a12,12,0,0,0,12,12H168a12,12,0,0,0,12-12V180h36a12,12,0,0,0,12-12V40A12,12,0,0,0,216,28ZM156,204H52V100H156Zm48-48H180V88a12,12,0,0,0-12-12H100V52H204Z"/>`],["fill",o`<path d="M216,32H88a8,8,0,0,0-8,8V80H40a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8H168a8,8,0,0,0,8-8V176h40a8,8,0,0,0,8-8V40A8,8,0,0,0,216,32Zm-8,128H176V88a8,8,0,0,0-8-8H96V48H208Z"/>`],["duotone",o`<path d="M216,40V168H168V88H88V40Z" opacity="0.2"/><path d="M216,32H88a8,8,0,0,0-8,8V80H40a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8H168a8,8,0,0,0,8-8V176h40a8,8,0,0,0,8-8V40A8,8,0,0,0,216,32ZM160,208H48V96H160Zm48-48H176V88a8,8,0,0,0-8-8H96V48H208Z"/>`]]);e.styles=p`
    :host {
      display: contents;
    }
  `;s([V({type:String,reflect:!0})],e.prototype,"size",2);s([V({type:String,reflect:!0})],e.prototype,"weight",2);s([V({type:String,reflect:!0})],e.prototype,"color",2);s([V({type:Boolean,reflect:!0})],e.prototype,"mirrored",2);e=s([f("ph-copy")],e);export{e as PhCopy};
