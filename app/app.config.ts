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
      },
    },
  },
})
