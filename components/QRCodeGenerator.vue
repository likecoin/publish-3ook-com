<template>
  <UCard
    :ui="{
      root: 'rounded-none ring-0',
      header: 'flex justify-between items-center gap-2',
      body: '!p-0',
      footer: 'flex justify-center items-center gap-2'
    }"
  >
    <div v-if="!isReadonlyMode" class="grid grid-cols-2 gap-4 p-4 print:hidden">
      <UFormField :label="$t('qr_generator.pick_dot')">
        <URadioGroup
          v-model="selectedDotStyle"
          :items="dotStyleOptions"
        />
      </UFormField>
    </div>

    <USeparator v-if="!isReadonlyMode" />

    <div
      id="qr-code"
      ref="qrCodeRef"
      class="qr-code-container flex justify-center items-center p-2 h-full"
    />

    <template v-if="!isReadonlyMode" #footer>
      <template v-if="isDownloadMode">
        <USelect
          v-model="downloadFileExtension"
          :items="[
            { value: 'svg', label: 'SVG' },
            { value: 'png', label: 'PNG' },
            { value: 'jpeg', label: 'JPEG' },
            { value: 'webp', label: 'WEBP' },
          ]"
        />

        <UButton
          :label="$t('qr_generator.download')"
          variant="outline"
          color="primary"
          @click="download"
        />
      </template>

      <UButton
        v-if="isConfigMode"
        :label="$t('qr_generator.save_config')"
        variant="outline"
        color="primary"
        @click="saveConfig"
      />
    </template>
  </UCard>
</template>

<script setup lang="ts">
import QRCodeStyling, { type FileExtension } from '@likecoin/qr-code-styling'

const props = defineProps({
  data: {
    type: String,
    default: ''
  },
  fileName: {
    type: String,
    default: ''
  },
  icon: {
    type: String,
    default: DEFAULT_QR_CODE_ICON
  },
  color: {
    type: String,
    default: DEFAULT_QR_CODE_COLOR
  },
  dotStyle: {
    type: String,
    default: DEFAULT_QR_CODE_DOT_STYLE
  },
  width: {
    type: Number,
    default: 300
  },
  height: {
    type: Number,
    default: 300
  },
  mode: {
    type: String,
    default: 'download'
  }
})

const isReadonlyMode = computed(() => props.mode === 'readonly')
const isDownloadMode = computed(() => props.mode === 'download')
const isConfigMode = computed(() => props.mode === 'config')

const selectedIcon = ref(props.icon)
const selectedColor = ref(props.color)
const selectedDotStyle = ref(props.dotStyle || 'square')

const downloadFileExtension = ref('svg')

const emit = defineEmits(['save', 'update:icon', 'update:color', 'update:dotStyle'])

const options = computed(() => getQRCodeOptions({
  width: props.width,
  height: props.height,
  data: props.data,
  fillColor: selectedColor.value,
  image: selectedIcon.value === 'none' ? undefined : getQRCodeIcon(selectedIcon.value),
  dotStyle: selectedDotStyle.value
}))
const qrCode = ref<QRCodeStyling | null>(null)
const qrCodeRef = ref(null)

watch([selectedIcon, selectedColor, selectedDotStyle, () => props.data], () => {
  qrCode.value?.update(options.value)
})

onMounted(async () => {
  const { default: QRCodeStyling } = await import('@likecoin/qr-code-styling')
  qrCode.value = new QRCodeStyling(options.value)
  if (qrCode.value && qrCodeRef.value) {
    qrCode.value.append(qrCodeRef.value)
  }
})

async function download () {
  const { default: QRCodeStyling } = await import('@likecoin/qr-code-styling')
  const tempInstance = new QRCodeStyling(options.value)
  tempInstance.download({ extension: downloadFileExtension.value as FileExtension, name: props.fileName })
}

function saveConfig () {
  emit('update:icon', selectedIcon.value)
  emit('update:color', selectedColor.value)
  emit('update:dotStyle', selectedDotStyle.value)
  emit('save', { icon: selectedIcon.value, color: selectedColor.value, dotStyle: selectedDotStyle.value })
}
</script>

<style>
.qr-code-container > svg {
  max-height: 40vh !important;
}
</style>
