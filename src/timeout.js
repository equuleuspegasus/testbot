export const timeout = function (ms) {
    return new Promise((r) => {
        setTimeout(r, ms)
    })
}
