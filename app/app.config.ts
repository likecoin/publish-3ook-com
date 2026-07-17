export default defineAppConfig({
  ui: {
    colors: {
      primary: 'like-green',
      neutral: 'slate',
    },
    formField: {
      slots: {
        root: 'w-full',
      },
    },
    input: {
      slots: {
        root: 'w-full',
      },
    },
    textarea: {
      slots: {
        root: 'w-full',
      },
    },
    table: {
      slots: {
        // Show a pointer cursor on rows wired with @select (data-selectable),
        // so clickable rows signal their interactivity.
        tr: 'data-[selectable=true]:cursor-pointer',
        // Keep CJK headers from breaking mid-word; wrap at spaces and punctuation only.
        th: 'break-keep',
      },
    },
  },
})
