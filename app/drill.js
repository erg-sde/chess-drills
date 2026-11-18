// Drill page logic (board, drilling, spaced repetition, steppers). Started as the "Drill Your Games" Claude artifact.
{
const $ = (id) => document.getElementById(id);
const FILES = "abcdefgh";
const PIECES = {"wp": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2aWV3Qm94PSIwIDAgNDUgNDUiIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PGcgaWQ9IndoaXRlLXBhd24iIGNsYXNzPSJ3aGl0ZSBwYXduIj48cGF0aCBkPSJNMjIuNSA5Yy0yLjIxIDAtNCAxLjc5LTQgNCAwIC44OS4yOSAxLjcxLjc4IDIuMzhDMTcuMzMgMTYuNSAxNiAxOC41OSAxNiAyMWMwIDIuMDMuOTQgMy44NCAyLjQxIDUuMDMtMyAxLjA2LTcuNDEgNS41NS03LjQxIDEzLjQ3aDIzYzAtNy45Mi00LjQxLTEyLjQxLTcuNDEtMTMuNDcgMS40Ny0xLjE5IDIuNDEtMyAyLjQxLTUuMDMgMC0yLjQxLTEuMzMtNC41LTMuMjgtNS42Mi40OS0uNjcuNzgtMS40OS43OC0yLjM4IDAtMi4yMS0xLjc5LTQtNC00eiIgZmlsbD0iI2ZmZiIgc3Ryb2tlPSIjMDAwIiBzdHJva2Utd2lkdGg9IjEuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiAvPjwvZz48L3N2Zz4=", "wn": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2aWV3Qm94PSIwIDAgNDUgNDUiIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PGcgaWQ9IndoaXRlLWtuaWdodCIgY2xhc3M9IndoaXRlIGtuaWdodCIgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0gMjIsMTAgQyAzMi41LDExIDM4LjUsMTggMzgsMzkgTCAxNSwzOSBDIDE1LDMwIDI1LDMyLjUgMjMsMTgiIHN0eWxlPSJmaWxsOiNmZmZmZmY7IHN0cm9rZTojMDAwMDAwOyIgLz48cGF0aCBkPSJNIDI0LDE4IEMgMjQuMzgsMjAuOTEgMTguNDUsMjUuMzcgMTYsMjcgQyAxMywyOSAxMy4xOCwzMS4zNCAxMSwzMSBDIDkuOTU4LDMwLjA2IDEyLjQxLDI3Ljk2IDExLDI4IEMgMTAsMjggMTEuMTksMjkuMjMgMTAsMzAgQyA5LDMwIDUuOTk3LDMxIDYsMjYgQyA2LDI0IDEyLDE0IDEyLDE0IEMgMTIsMTQgMTMuODksMTIuMSAxNCwxMC41IEMgMTMuMjcsOS41MDYgMTMuNSw4LjUgMTMuNSw3LjUgQyAxNC41LDYuNSAxNi41LDEwIDE2LjUsMTAgTCAxOC41LDEwIEMgMTguNSwxMCAxOS4yOCw4LjAwOCAyMSw3IEMgMjIsNyAyMiwxMCAyMiwxMCIgc3R5bGU9ImZpbGw6I2ZmZmZmZjsgc3Ryb2tlOiMwMDAwMDA7IiAvPjxwYXRoIGQ9Ik0gOS41IDI1LjUgQSAwLjUgMC41IDAgMSAxIDguNSwyNS41IEEgMC41IDAuNSAwIDEgMSA5LjUgMjUuNSB6IiBzdHlsZT0iZmlsbDojMDAwMDAwOyBzdHJva2U6IzAwMDAwMDsiIC8+PHBhdGggZD0iTSAxNSAxNS41IEEgMC41IDEuNSAwIDEgMSAxNCwxNS41IEEgMC41IDEuNSAwIDEgMSAxNSAxNS41IHoiIHRyYW5zZm9ybT0ibWF0cml4KDAuODY2LDAuNSwtMC41LDAuODY2LDkuNjkzLC01LjE3MykiIHN0eWxlPSJmaWxsOiMwMDAwMDA7IHN0cm9rZTojMDAwMDAwOyIgLz48L2c+PC9zdmc+", "wb": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2aWV3Qm94PSIwIDAgNDUgNDUiIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PGcgaWQ9IndoaXRlLWJpc2hvcCIgY2xhc3M9IndoaXRlIGJpc2hvcCIgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxnIGZpbGw9IiNmZmYiIHN0cm9rZS1saW5lY2FwPSJidXR0Ij48cGF0aCBkPSJNOSAzNmMzLjM5LS45NyAxMC4xMS40MyAxMy41LTIgMy4zOSAyLjQzIDEwLjExIDEuMDMgMTMuNSAyIDAgMCAxLjY1LjU0IDMgMi0uNjguOTctMS42NS45OS0zIC41LTMuMzktLjk3LTEwLjExLjQ2LTEzLjUtMS0zLjM5IDEuNDYtMTAuMTEuMDMtMTMuNSAxLTEuMzU0LjQ5LTIuMzIzLjQ3LTMtLjUgMS4zNTQtMS45NCAzLTIgMy0yek0xNSAzMmMyLjUgMi41IDEyLjUgMi41IDE1IDAgLjUtMS41IDAtMiAwLTIgMC0yLjUtMi41LTQtMi41LTQgNS41LTEuNSA2LTExLjUtNS0xNS41LTExIDQtMTAuNSAxNC01IDE1LjUgMCAwLTIuNSAxLjUtMi41IDQgMCAwLS41LjUgMCAyek0yNSA4YTIuNSAyLjUgMCAxIDEtNSAwIDIuNSAyLjUgMCAxIDEgNSAweiIgLz48L2c+PHBhdGggZD0iTTE3LjUgMjZoMTBNMTUgMzBoMTVtLTcuNS0xNC41djVNMjAgMThoNSIgc3Ryb2tlLWxpbmVqb2luPSJtaXRlciIgLz48L2c+PC9zdmc+", "wr": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2aWV3Qm94PSIwIDAgNDUgNDUiIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PGcgaWQ9IndoaXRlLXJvb2siIGNsYXNzPSJ3aGl0ZSByb29rIiBmaWxsPSIjZmZmIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTkgMzloMjd2LTNIOXYzek0xMiAzNnYtNGgyMXY0SDEyek0xMSAxNFY5aDR2Mmg1VjloNXYyaDVWOWg0djUiIHN0cm9rZS1saW5lY2FwPSJidXR0IiAvPjxwYXRoIGQ9Ik0zNCAxNGwtMyAzSDE0bC0zLTMiIC8+PHBhdGggZD0iTTMxIDE3djEyLjVIMTRWMTciIHN0cm9rZS1saW5lY2FwPSJidXR0IiBzdHJva2UtbGluZWpvaW49Im1pdGVyIiAvPjxwYXRoIGQ9Ik0zMSAyOS41bDEuNSAyLjVoLTIwbDEuNS0yLjUiIC8+PHBhdGggZD0iTTExIDE0aDIzIiBmaWxsPSJub25lIiBzdHJva2UtbGluZWpvaW49Im1pdGVyIiAvPjwvZz48L3N2Zz4=", "wq": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2aWV3Qm94PSIwIDAgNDUgNDUiIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PGcgaWQ9IndoaXRlLXF1ZWVuIiBjbGFzcz0id2hpdGUgcXVlZW4iIGZpbGw9IiNmZmYiIGZpbGwtcnVsZT0iZXZlbm9kZCIgc3Ryb2tlPSIjMDAwIiBzdHJva2Utd2lkdGg9IjEuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNOCAxMmEyIDIgMCAxIDEtNCAwIDIgMiAwIDEgMSA0IDB6TTI0LjUgNy41YTIgMiAwIDEgMS00IDAgMiAyIDAgMSAxIDQgMHpNNDEgMTJhMiAyIDAgMSAxLTQgMCAyIDIgMCAxIDEgNCAwek0xNiA4LjVhMiAyIDAgMSAxLTQgMCAyIDIgMCAxIDEgNCAwek0zMyA5YTIgMiAwIDEgMS00IDAgMiAyIDAgMSAxIDQgMHoiIC8+PHBhdGggZD0iTTkgMjZjOC41LTEuNSAyMS0xLjUgMjcgMGwyLTEyLTcgMTFWMTFsLTUuNSAxMy41LTMtMTUtMyAxNS01LjUtMTRWMjVMNyAxNGwyIDEyek05IDI2YzAgMiAxLjUgMiAyLjUgNCAxIDEuNSAxIDEgLjUgMy41LTEuNSAxLTEuNSAyLjUtMS41IDIuNS0xLjUgMS41LjUgMi41LjUgMi41IDYuNSAxIDE2LjUgMSAyMyAwIDAgMCAxLjUtMSAwLTIuNSAwIDAgLjUtMS41LTEtMi41LS41LTIuNS0uNS0yIC41LTMuNSAxLTIgMi41LTIgMi41LTQtOC41LTEuNS0xOC41LTEuNS0yNyAweiIgc3Ryb2tlLWxpbmVjYXA9ImJ1dHQiIC8+PHBhdGggZD0iTTExLjUgMzBjMy41LTEgMTguNS0xIDIyIDBNMTIgMzMuNWM2LTEgMTUtMSAyMSAwIiBmaWxsPSJub25lIiAvPjwvZz48L3N2Zz4=", "wk": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2aWV3Qm94PSIwIDAgNDUgNDUiIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PGcgaWQ9IndoaXRlLWtpbmciIGNsYXNzPSJ3aGl0ZSBraW5nIiBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTIyLjUgMTEuNjNWNk0yMCA4aDUiIHN0cm9rZS1saW5lam9pbj0ibWl0ZXIiIC8+PHBhdGggZD0iTTIyLjUgMjVzNC41LTcuNSAzLTEwLjVjMCAwLTEtMi41LTMtMi41cy0zIDIuNS0zIDIuNWMtMS41IDMgMyAxMC41IDMgMTAuNSIgZmlsbD0iI2ZmZiIgc3Ryb2tlLWxpbmVjYXA9ImJ1dHQiIHN0cm9rZS1saW5lam9pbj0ibWl0ZXIiIC8+PHBhdGggZD0iTTExLjUgMzdjNS41IDMuNSAxNS41IDMuNSAyMSAwdi03czktNC41IDYtMTAuNWMtNC02LjUtMTMuNS0zLjUtMTYgNFYyN3YtMy41Yy0zLjUtNy41LTEzLTEwLjUtMTYtNC0zIDYgNSAxMCA1IDEwVjM3eiIgZmlsbD0iI2ZmZiIgLz48cGF0aCBkPSJNMTEuNSAzMGM1LjUtMyAxNS41LTMgMjEgMG0tMjEgMy41YzUuNS0zIDE1LjUtMyAyMSAwbS0yMSAzLjVjNS41LTMgMTUuNS0zIDIxIDAiIC8+PC9nPjwvc3ZnPg==", "bp": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2aWV3Qm94PSIwIDAgNDUgNDUiIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PGcgaWQ9ImJsYWNrLXBhd24iIGNsYXNzPSJibGFjayBwYXduIj48cGF0aCBkPSJNMjIuNSA5Yy0yLjIxIDAtNCAxLjc5LTQgNCAwIC44OS4yOSAxLjcxLjc4IDIuMzhDMTcuMzMgMTYuNSAxNiAxOC41OSAxNiAyMWMwIDIuMDMuOTQgMy44NCAyLjQxIDUuMDMtMyAxLjA2LTcuNDEgNS41NS03LjQxIDEzLjQ3aDIzYzAtNy45Mi00LjQxLTEyLjQxLTcuNDEtMTMuNDcgMS40Ny0xLjE5IDIuNDEtMyAyLjQxLTUuMDMgMC0yLjQxLTEuMzMtNC41LTMuMjgtNS42Mi40OS0uNjcuNzgtMS40OS43OC0yLjM4IDAtMi4yMS0xLjc5LTQtNC00eiIgZmlsbD0iIzAwMCIgc3Ryb2tlPSIjMDAwIiBzdHJva2Utd2lkdGg9IjEuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiAvPjwvZz48L3N2Zz4=", "bn": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2aWV3Qm94PSIwIDAgNDUgNDUiIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PGcgaWQ9ImJsYWNrLWtuaWdodCIgY2xhc3M9ImJsYWNrIGtuaWdodCIgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0gMjIsMTAgQyAzMi41LDExIDM4LjUsMTggMzgsMzkgTCAxNSwzOSBDIDE1LDMwIDI1LDMyLjUgMjMsMTgiIHN0eWxlPSJmaWxsOiMwMDAwMDA7IHN0cm9rZTojMDAwMDAwOyIgLz48cGF0aCBkPSJNIDI0LDE4IEMgMjQuMzgsMjAuOTEgMTguNDUsMjUuMzcgMTYsMjcgQyAxMywyOSAxMy4xOCwzMS4zNCAxMSwzMSBDIDkuOTU4LDMwLjA2IDEyLjQxLDI3Ljk2IDExLDI4IEMgMTAsMjggMTEuMTksMjkuMjMgMTAsMzAgQyA5LDMwIDUuOTk3LDMxIDYsMjYgQyA2LDI0IDEyLDE0IDEyLDE0IEMgMTIsMTQgMTMuODksMTIuMSAxNCwxMC41IEMgMTMuMjcsOS41MDYgMTMuNSw4LjUgMTMuNSw3LjUgQyAxNC41LDYuNSAxNi41LDEwIDE2LjUsMTAgTCAxOC41LDEwIEMgMTguNSwxMCAxOS4yOCw4LjAwOCAyMSw3IEMgMjIsNyAyMiwxMCAyMiwxMCIgc3R5bGU9ImZpbGw6IzAwMDAwMDsgc3Ryb2tlOiMwMDAwMDA7IiAvPjxwYXRoIGQ9Ik0gOS41IDI1LjUgQSAwLjUgMC41IDAgMSAxIDguNSwyNS41IEEgMC41IDAuNSAwIDEgMSA5LjUgMjUuNSB6IiBzdHlsZT0iZmlsbDojZWNlY2VjOyBzdHJva2U6I2VjZWNlYzsiIC8+PHBhdGggZD0iTSAxNSAxNS41IEEgMC41IDEuNSAwIDEgMSAxNCwxNS41IEEgMC41IDEuNSAwIDEgMSAxNSAxNS41IHoiIHRyYW5zZm9ybT0ibWF0cml4KDAuODY2LDAuNSwtMC41LDAuODY2LDkuNjkzLC01LjE3MykiIHN0eWxlPSJmaWxsOiNlY2VjZWM7IHN0cm9rZTojZWNlY2VjOyIgLz48cGF0aCBkPSJNIDI0LjU1LDEwLjQgTCAyNC4xLDExLjg1IEwgMjQuNiwxMiBDIDI3Ljc1LDEzIDMwLjI1LDE0LjQ5IDMyLjUsMTguNzUgQyAzNC43NSwyMy4wMSAzNS43NSwyOS4wNiAzNS4yNSwzOSBMIDM1LjIsMzkuNSBMIDM3LjQ1LDM5LjUgTCAzNy41LDM5IEMgMzgsMjguOTQgMzYuNjIsMjIuMTUgMzQuMjUsMTcuNjYgQyAzMS44OCwxMy4xNyAyOC40NiwxMS4wMiAyNS4wNiwxMC41IEwgMjQuNTUsMTAuNCB6ICIgc3R5bGU9ImZpbGw6I2VjZWNlYzsgc3Ryb2tlOm5vbmU7IiAvPjwvZz48L3N2Zz4=", "bb": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2aWV3Qm94PSIwIDAgNDUgNDUiIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PGcgaWQ9ImJsYWNrLWJpc2hvcCIgY2xhc3M9ImJsYWNrIGJpc2hvcCIgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik05IDM2YzMuMzktLjk3IDEwLjExLjQzIDEzLjUtMiAzLjM5IDIuNDMgMTAuMTEgMS4wMyAxMy41IDIgMCAwIDEuNjUuNTQgMyAyLS42OC45Ny0xLjY1Ljk5LTMgLjUtMy4zOS0uOTctMTAuMTEuNDYtMTMuNS0xLTMuMzkgMS40Ni0xMC4xMS4wMy0xMy41IDEtMS4zNTQuNDktMi4zMjMuNDctMy0uNSAxLjM1NC0xLjk0IDMtMiAzLTJ6bTYtNGMyLjUgMi41IDEyLjUgMi41IDE1IDAgLjUtMS41IDAtMiAwLTIgMC0yLjUtMi41LTQtMi41LTQgNS41LTEuNSA2LTExLjUtNS0xNS41LTExIDQtMTAuNSAxNC01IDE1LjUgMCAwLTIuNSAxLjUtMi41IDQgMCAwLS41LjUgMCAyek0yNSA4YTIuNSAyLjUgMCAxIDEtNSAwIDIuNSAyLjUgMCAxIDEgNSAweiIgZmlsbD0iIzAwMCIgc3Ryb2tlLWxpbmVjYXA9ImJ1dHQiIC8+PHBhdGggZD0iTTE3LjUgMjZoMTBNMTUgMzBoMTVtLTcuNS0xNC41djVNMjAgMThoNSIgc3Ryb2tlPSIjZmZmIiBzdHJva2UtbGluZWpvaW49Im1pdGVyIiAvPjwvZz48L3N2Zz4=", "br": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2aWV3Qm94PSIwIDAgNDUgNDUiIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PGcgaWQ9ImJsYWNrLXJvb2siIGNsYXNzPSJibGFjayByb29rIiBmaWxsPSIjMDAwIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTkgMzloMjd2LTNIOXYzek0xMi41IDMybDEuNS0yLjVoMTdsMS41IDIuNWgtMjB6TTEyIDM2di00aDIxdjRIMTJ6IiBzdHJva2UtbGluZWNhcD0iYnV0dCIgLz48cGF0aCBkPSJNMTQgMjkuNXYtMTNoMTd2MTNIMTR6IiBzdHJva2UtbGluZWNhcD0iYnV0dCIgc3Ryb2tlLWxpbmVqb2luPSJtaXRlciIgLz48cGF0aCBkPSJNMTQgMTYuNUwxMSAxNGgyM2wtMyAyLjVIMTR6TTExIDE0VjloNHYyaDVWOWg1djJoNVY5aDR2NUgxMXoiIHN0cm9rZS1saW5lY2FwPSJidXR0IiAvPjxwYXRoIGQ9Ik0xMiAzNS41aDIxTTEzIDMxLjVoMTlNMTQgMjkuNWgxN00xNCAxNi41aDE3TTExIDE0aDIzIiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMSIgc3Ryb2tlLWxpbmVqb2luPSJtaXRlciIgLz48L2c+PC9zdmc+", "bq": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2aWV3Qm94PSIwIDAgNDUgNDUiIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PGcgaWQ9ImJsYWNrLXF1ZWVuIiBjbGFzcz0iYmxhY2sgcXVlZW4iIGZpbGw9IiMwMDAiIGZpbGwtcnVsZT0iZXZlbm9kZCIgc3Ryb2tlPSIjMDAwIiBzdHJva2Utd2lkdGg9IjEuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48ZyBmaWxsPSIjMDAwIiBzdHJva2U9Im5vbmUiPjxjaXJjbGUgY3g9IjYiIGN5PSIxMiIgcj0iMi43NSIgLz48Y2lyY2xlIGN4PSIxNCIgY3k9IjkiIHI9IjIuNzUiIC8+PGNpcmNsZSBjeD0iMjIuNSIgY3k9IjgiIHI9IjIuNzUiIC8+PGNpcmNsZSBjeD0iMzEiIGN5PSI5IiByPSIyLjc1IiAvPjxjaXJjbGUgY3g9IjM5IiBjeT0iMTIiIHI9IjIuNzUiIC8+PC9nPjxwYXRoIGQ9Ik05IDI2YzguNS0xLjUgMjEtMS41IDI3IDBsMi41LTEyLjVMMzEgMjVsLS4zLTE0LjEtNS4yIDEzLjYtMy0xNC41LTMgMTQuNS01LjItMTMuNkwxNCAyNSA2LjUgMTMuNSA5IDI2ek05IDI2YzAgMiAxLjUgMiAyLjUgNCAxIDEuNSAxIDEgLjUgMy41LTEuNSAxLTEuNSAyLjUtMS41IDIuNS0xLjUgMS41LjUgMi41LjUgMi41IDYuNSAxIDE2LjUgMSAyMyAwIDAgMCAxLjUtMSAwLTIuNSAwIDAgLjUtMS41LTEtMi41LS41LTIuNS0uNS0yIC41LTMuNSAxLTIgMi41LTIgMi41LTQtOC41LTEuNS0xOC41LTEuNS0yNyAweiIgc3Ryb2tlLWxpbmVjYXA9ImJ1dHQiIC8+PHBhdGggZD0iTTExIDM4LjVhMzUgMzUgMSAwIDAgMjMgMCIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9ImJ1dHQiIC8+PHBhdGggZD0iTTExIDI5YTM1IDM1IDEgMCAxIDIzIDBNMTIuNSAzMS41aDIwTTExLjUgMzQuNWEzNSAzNSAxIDAgMCAyMiAwTTEwLjUgMzcuNWEzNSAzNSAxIDAgMCAyNCAwIiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIC8+PC9nPjwvc3ZnPg==", "bk": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2aWV3Qm94PSIwIDAgNDUgNDUiIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PGcgaWQ9ImJsYWNrLWtpbmciIGNsYXNzPSJibGFjayBraW5nIiBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTIyLjUgMTEuNjNWNiIgc3Ryb2tlLWxpbmVqb2luPSJtaXRlciIgLz48cGF0aCBkPSJNMjIuNSAyNXM0LjUtNy41IDMtMTAuNWMwIDAtMS0yLjUtMy0yLjVzLTMgMi41LTMgMi41Yy0xLjUgMyAzIDEwLjUgMyAxMC41IiBmaWxsPSIjMDAwIiBzdHJva2UtbGluZWNhcD0iYnV0dCIgc3Ryb2tlLWxpbmVqb2luPSJtaXRlciIgLz48cGF0aCBkPSJNMTEuNSAzN2M1LjUgMy41IDE1LjUgMy41IDIxIDB2LTdzOS00LjUgNi0xMC41Yy00LTYuNS0xMy41LTMuNS0xNiA0VjI3di0zLjVjLTMuNS03LjUtMTMtMTAuNS0xNi00LTMgNiA1IDEwIDUgMTBWMzd6IiBmaWxsPSIjMDAwIiAvPjxwYXRoIGQ9Ik0yMCA4aDUiIHN0cm9rZS1saW5lam9pbj0ibWl0ZXIiIC8+PHBhdGggZD0iTTMyIDI5LjVzOC41LTQgNi4wMy05LjY1QzM0LjE1IDE0IDI1IDE4IDIyLjUgMjQuNWwuMDEgMi4xLS4wMS0yLjFDMjAgMTggOS45MDYgMTQgNi45OTcgMTkuODVjLTIuNDk3IDUuNjUgNC44NTMgOSA0Ljg1MyA5TTExLjUgMzBjNS41LTMgMTUuNS0zIDIxIDBtLTIxIDMuNWM1LjUtMyAxNS41LTMgMjEgMG0tMjEgMy41YzUuNS0zIDE1LjUtMyAyMSAwIiBzdHJva2U9IiNmZmYiIC8+PC9nPjwvc3ZnPg=="};
const IV = [0, 4, 24, 72, 168, 336, 720, 2160].map((h) => h * 3600e3); // SRS levels in ms
const NEW_PER_SESSION = 10;
let DATA = null, CARDS = [], BY = {}, deck = "all", mode = "drill";
let P = {}; // progress: id -> {l: level, d: due ms, r: right, w: wrong, t: last ms}
let card = null, game = null, line = [], pos = 0, from = 0, view = 0, orient = "w", sel = null, failed = false, done = false, busy = false;
let queue = [], newLeft = NEW_PER_SESSION, timer = 0, practice = false, slips = [];
function slip(i, how) { if (!slips.some((x) => x.i === i)) slips.push({ i, how }); failed = true; }

const strip = (s) => s.replace(/[+#?!]/g, "");
// Short, stable card codes for talking about cards ("DEF-54365"): deck prefix + start of the card's hash id.
const PFX = { openings: "OPN", safety: "HNG", finish: "WIN", defend: "DEF", archive: "ARC" };
const code = (c) => (PFX[c.was || c.deck] || (c.deck.startsWith("rep-") ? c.deck.slice(4).toUpperCase() : "CRD")) + "-" + c.id.split("-").pop().slice(0, 5).toUpperCase();
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

// ---------- progress: kept here, persisted and synced by the host app (hooks.onProgress) ----------
let HOOKS = {};
try { P = JSON.parse(store.get("drill-progress") || "{}") || {}; } catch (e) { P = {}; }
async function save() {
 store.set("drill-progress", JSON.stringify(P));
 try { HOOKS.onProgress && HOOKS.onProgress(P); } catch (e) { console.error(e); }
}

// ---------- board ----------
function sqXY(name) { const f = FILES.indexOf(name[0]), r = +name[1] - 1; return orient === "w" ? [f, 7 - r] : [7 - f, r]; }
function draw() {
 const g = new Chess(card.fen0 || undefined);
 for (let i = 0; i < view; i++) g.move(line[i], { sloppy: true });
 const b = g.board(), last = view > 0 ? lastMove(view) : null, el = $("board");
 const legal = sel && !done && view === pos && isMyTurn() ? game.moves({ square: sel, verbose: true }) : [];
 el.innerHTML = "";
 const ord = orient === "w" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
 ord.forEach((r, ri) => ord.forEach((f, fi) => {
  const n = FILES[f] + (8 - r), d = document.createElement("div"), p = b[r][f];
  d.className = "sq " + ((r + f) % 2 ? "d" : "l"); d.dataset.sq = n;
  if (last && (last.from === n || last.to === n)) d.classList.add("hl");
  if (sel === n) d.classList.add("sel");
  const lm = legal.find((m) => m.to === n);
  if (lm) d.classList.add(p ? "cap" : "dot");
  if (p && p.type === "k" && g.in_check() && p.color === g.turn()) d.classList.add("chk");
  if (p) { const s = document.createElement("img"); s.className = "pc"; s.src = PIECES[p.color + p.type]; s.alt = ""; s.draggable = false; d.appendChild(s); }
  if (ri === 7) { const c = document.createElement("span"); c.className = "co f"; c.textContent = FILES[f]; d.appendChild(c); }
  if (fi === 0) { const c = document.createElement("span"); c.className = "co r"; c.textContent = 8 - r; d.appendChild(c); }
  d.setAttribute("aria-label", n + (p ? (p.color === "w" ? " white " : " black ") + p.type : ""));
  el.appendChild(d);
 }));
 drawMoves(); drawCtl();
 const fen = g.fen();
 $("analyse").href = "https://lichess.org/analysis/standard/" + fen.replace(/ /g, "_") + "?color=" + (orient === "w" ? "white" : "black");
}
let ARROWS = [];
function lastMove(n) { const g = new Chess(card.fen0 || undefined); let m = null; for (let i = 0; i < n; i++) m = g.move(line[i], { sloppy: true }); return m; }
function arrow(fromSq, toSq, color) {
 const [x1, y1] = sqXY(fromSq), [x2, y2] = sqXY(toSq), cx1 = x1 + .5, cy1 = y1 + .5, cx2 = x2 + .5, cy2 = y2 + .5;
 const a = Math.atan2(cy2 - cy1, cx2 - cx1), L = Math.hypot(cx2 - cx1, cy2 - cy1) - .32;
 const ex = cx1 + Math.cos(a) * L, ey = cy1 + Math.sin(a) * L;
 const h = (t, d) => `${ex + Math.cos(a + t) * d},${ey + Math.sin(a + t) * d}`;
 return `<line x1="${cx1}" y1="${cy1}" x2="${ex}" y2="${ey}" stroke="${color}" stroke-width=".17" stroke-linecap="round" opacity=".85"/>` +
  `<polygon points="${cx2 - Math.cos(a) * .12},${cy2 - Math.sin(a) * .12} ${h(Math.PI * .82, .42)} ${h(-Math.PI * .82, .42)}" fill="${color}" opacity=".9"/>`;
}
function drawArrows() { $("arrows").innerHTML = ARROWS.map((x) => arrow(...x)).join(""); }
function moveOf(i) { const g = new Chess(card.fen0 || undefined); for (let k = 0; k < i; k++) g.move(line[k], { sloppy: true }); return g.move(line[i], { sloppy: true }); }

function drawMoves() {
 const el = $("moves"); el.innerHTML = "";
 const g = new Chess(card.fen0 || undefined), startBlack = g.turn() === "b", base = g.history().length;
 const n0 = card.fen0 ? +card.fen0.split(" ")[5] : 1;
 const upto = done || mode === "study" ? line.length : pos;
 line.forEach((s, i) => {
  if (i >= upto) return;
  const blackMove = (i + (startBlack ? 1 : 0)) % 2 === 1, num = n0 + Math.floor((i + (startBlack ? 1 : 0)) / 2);
  if (!blackMove || i === 0) { const sp = document.createElement("span"); sp.className = "num"; sp.textContent = num + (blackMove ? "…" : "."); el.appendChild(sp); }
  const b = document.createElement("button");
  b.className = "mv" + (i === view - 1 ? " on" : "") + (i === card.key ? " key" : "");
  b.textContent = s;
  const nag = (card.nags || {})[i]; if (nag) { const t = document.createElement("span"); t.className = nag.includes("?") ? "nb" : "ng"; t.textContent = nag; b.appendChild(t); }
  b.onclick = () => go(i + 1);
  el.appendChild(b);
 });
 const on = el.querySelector(".on"); if (on) el.scrollTop = Math.max(0, on.offsetTop - el.offsetTop - el.clientHeight / 2);
}
function drawCtl() {
 const max = done || mode === "study" ? line.length : pos;
 $("b0").disabled = $("b1").disabled = view === 0;
 $("b2").disabled = $("b3").disabled = view >= max;
}
function go(v) {
 const max = done || mode === "study" ? line.length : pos;
 view = Math.max(0, Math.min(max, v)); sel = null;
 ARROWS = [];
 const note = (card.notes || {})[view - 1];
 if ((done || mode === "study") && view > 0) {
  const m = moveOf(view - 1);
  if (note) say("", `${label(view - 1)} ${line[view - 1]}`, note);
 }
 if ((done || mode === "study") && view === card.key && card.played && card.playedMove) ARROWS.push([card.playedMove.from, card.playedMove.to, "#c0392b"]);
 if ((done || mode === "study") && view === card.key) { const m = moveOf(card.key); ARROWS.push([m.from, m.to, "#1f9a5c"]); if (!$("result").hidden) say("", "Key position", "Green arrow: the move to learn. Red arrow: what you played in the game."); else if (card.keyNote) say("", "Key position", card.keyNote); }
 draw(); drawArrows();
}
function label(i) {
 const g = new Chess(card.fen0 || undefined), sb = g.turn() === "b", n0 = card.fen0 ? +card.fen0.split(" ")[5] : 1;
 const k = i + (sb ? 1 : 0); return (n0 + Math.floor(k / 2)) + (k % 2 ? "…" : ".");
}
function say(kind, who, text) {
 const v = $("verdict"); v.className = "verdict " + kind;
 v.innerHTML = '<div class="who"></div><p></p>';
 v.querySelector(".who").textContent = who; v.querySelector("p").textContent = text;
}
function isMyTurn() { return game && pos >= card.key && game.turn() === card.orient && !done && mode === "drill"; }

// ---------- drilling ----------
function load(c, m, prac) {
 practice = !!prac; slips = []; $("result").hidden = true;
 exCtl?.abort(); $("exbox").hidden = true; $("exout").textContent = ""; $("exq").value = "";
 clearTimeout(timer); card = c; mode = m; line = c.moves; from = Math.max(0, c.key - (c.kind === "line" ? 4 : 2)); orient = c.orient; failed = false; done = false; sel = null; busy = false;
 game = new Chess(c.fen0 || undefined);
 for (let i = 0; i < from; i++) game.move(line[i], { sloppy: true });
 pos = from; view = from;
 if (!c.playedMove && c.played) { const g = new Chess(c.fen0 || undefined); for (let i = 0; i < c.key; i++) g.move(line[i], { sloppy: true }); c.playedMove = g.move(c.played, { sloppy: true }); }
 $("ctitle").textContent = c.title;
 const gm = c.game;
 $("cmeta").innerHTML = "";
 $("cmeta").append(document.createTextNode(`${code(c)} · ${DATA.decks.find((d) => d.id === c.deck).name}` + (gm ? ` · ${gm.date} · vs ${gm.opp} (${gm.result}) · ` : "")));
 if (gm) { const a = document.createElement("a"); a.href = gm.url; a.textContent = "game"; a.target = "_blank"; a.rel = "noopener"; $("cmeta").append(a); }
 $("cprompt").textContent = m === "study" ? "Study mode: step through with ◀ ▶ or the move list." : c.kind === "line" ? `Watch the last few moves, then find ${c.orient === "w" ? "White" : "Black"}'s move and play on.` : c.prompt;
 $("next").disabled = m === "drill" && !practice; $("hint").disabled = $("show").disabled = m === "study";
 $("retry").hidden = m === "drill"; $("retry").textContent = "Drill this card";
 if (m === "study") { done = true; say("", "Study", c.sub || ""); go(c.key); }
 else { say("", "Watch", "Replaying the moves that lead to the position…"); draw(); drawArrows(); autoplay(); }
}
function autoplay() {
 if (done) return;
 if (pos >= line.length) return finish();
 if (pos === card.key && !busy && !failed && view === pos) say("", "Your move", "Find the move. Use ◀ to step back to move 1 if you want the whole line.");
 if (pos < card.key || game.turn() !== card.orient) {
  busy = true;
  const mine = card; timer = setTimeout(() => { if (card !== mine || done) return; game.move(line[pos], { sloppy: true }); pos++; view = pos; busy = false; const n = (card.notes || {})[pos - 1]; if (n) say("", `${label(pos - 1)} ${line[pos - 1]}`, n); draw(); drawArrows(); autoplay(); }, pos < card.key ? 650 : 420);
 }
}
function tryMove(f, t) {
 const exp = line[pos];
 const promo = /=([QRBN])/.exec(exp) ? /=([QRBN])/.exec(exp)[1].toLowerCase() : "q";
 const m = game.move({ from: f, to: t, promotion: promo });
 if (!m) return false;
 const soft = (card.soft || {})[m.san];
 if (soft && strip(m.san) !== strip(exp) && pos === card.key) { game.undo(); say("", `${m.san} is OK`, soft); sel = null; const e = moveOf(pos); ARROWS = [[e.from, e.to, "#1f9a5c"]]; draw(); drawArrows(); return true; }
 if (game.in_checkmate() && strip(m.san) !== strip(exp)) { line = line.slice(0, pos).concat([m.san]); game.undo(); game.move(m.san); }
 const ok = game.in_checkmate() || strip(m.san) === strip(exp) || ((card.accept || {})[pos] || []).some((a) => strip(a) === strip(m.san));
 if (!ok) {
  game.undo(); slip(pos, `you tried ${m.san}`);
  const e = moveOf(pos);
  say("bad", `${m.san} isn't it`, (card.wrong || {})[m.san] || `Play ${exp} to continue.` + (card.played && strip(m.san) === strip(card.played) ? " That's what you played in the game." : ""));
  ARROWS = [[e.from, e.to, "#1f9a5c"]]; sel = null; draw(); drawArrows();
  return true;
 }
 if (strip(m.san) !== strip(line[pos])) {
  // An accepted alternative: keep YOUR move on the board and end the card here as solved.
  const main = line[pos];
  line = line.slice(0, pos).concat([m.san]);
  pos++; view = pos; sel = null; ARROWS = [];
  say("good", `${label(pos - 1)} ${m.san} ✓`, game.in_checkmate() ? "Checkmate." : `Also good. Stockfish's main move was ${main}; the card's notes follow that line. Retry the card to see it.`);
  draw(); drawArrows(); autoplay();
  return true;
 }
 pos++; view = pos; sel = null; ARROWS = [];
 const n = (card.notes || {})[pos - 1];
 say("good", `${label(pos - 1)} ${line[pos - 1]} ✓`, n || "Right.");
 draw(); drawArrows(); autoplay();
 return true;
}
function finish() {
 done = true;
 $("retry").hidden = false; $("retry").textContent = "Retry card";
 $("next").disabled = false; $("hint").disabled = $("show").disabled = true;
 let head;
 if (practice) head = failed ? "Practice run: not clean" : "Practice run: clean";
 else {
  const now = Date.now(), p = P[card.id] || { l: 0, r: 0, w: 0 };
  if (failed) { p.l = 1; p.w = (p.w || 0) + 1; requeue(card.id); } else { p.l = Math.min(IV.length - 1, (p.l || 0) + 1); p.r = (p.r || 0) + 1; }
  p.d = now + IV[p.l]; p.t = now; p.h = (p.h || []).concat([[now, failed ? 0 : 1]]).slice(-40); P[card.id] = p; save();
  head = failed ? "Card missed: it comes back later this session and in 4 hours" : `Card solved first try: next review in ${human(IV[p.l])}`;
  renderDecks(); renderList();
 }
 const r = $("result");
 r.className = "verdict " + (failed ? "bad" : "good"); r.hidden = false;
 $("rhead").textContent = head;
 $("rslip").textContent = slips.length ? "Slipped on " + slips.map((x) => `${label(x.i)} ${line[x.i]} (${x.how})`).join("; ") + "." : "";
 $("rnote").textContent = (practice ? "Retries are practice, so they don't change when this card is due. " : "") + (card.keyNote || card.summary || "");
 draw(); drawArrows();
}
$("tokey").onclick = () => go(card.key);
// ---------- explain (asks Claude, on the viewer's own account) ----------
let sampleFn = null, exCtl = null;
// sampleFn is set from hooks.explain in DrillApp.start (bring-your-own-key provider).
function numbered(moves, upto) {
 const out = [];
 for (let i = 0; i < upto; i++) { const l = label(i); out.push(l.endsWith(".") || i === 0 ? l.replace("…", "...") + moves[i] : moves[i]); }
 return out.join(" ");
}
function explainPrompt(question) {
 const g = new Chess(card.fen0 || undefined);
 for (let i = 0; i < view; i++) g.move(line[i], { sloppy: true });
 const side = card.orient === "w" ? "White" : "Black", toMove = g.turn() === "w" ? "White" : "Black";
 const keyMv = label(card.key).replace("…", "...") + line[card.key];
 const notes = Object.entries(card.notes || {}).map(([i, t]) => `- after ${label(+i).replace("…", "...")}${line[+i]}: ${t}`).join("\n");
 const atKey = view === card.key;
 const q = question || (card.deck.startsWith("rep-") && view <= card.key ? `What are the main ideas of this line for ${side}, and why is each of ${side}'s key moves played?` : atKey ? `Why is ${keyMv} the right move here${card.played && card.played !== line[card.key] ? `, and what's wrong with ${card.played}` : ""}? What is each side trying to do?`
   : view > 0 ? `Explain the move ${label(view - 1).replace("…", "...")}${line[view - 1]} that was just played, and what the position is about now.` : "Explain the ideas of this opening line.");
 return [
  `You are a chess coach explaining a position to a club player${DATA.rating ? ` (rated about ${DATA.rating})` : ""} who is drilling positions from their own games.`,
  "Explain ideas in plain language: name the pieces and squares, say what each side threatens or wants, and why the alternative fails.",
  "The moves, evaluations and engine line below come from Stockfish 16 and are correct; ground your answer in them. Do not invent long variations: any line you give must be at most 3 moves and legal in the position shown. If you are not sure of something, say so instead of guessing.",
  "Answer in at most 180 words of plain text, no headings or markdown.",
  "", `Card: ${card.title}${card.sub ? " (" + card.sub + ")" : ""}`,
  `The player is training ${side}'s moves.`,
  `Moves so far: ${numbered(line, view) || "(starting position)"}`,
  `Position now (FEN): ${g.fen()}`, `${toMove} to move. Board (uppercase = White, White at the bottom):`, g.ascii(),
  card.deck.startsWith("rep-") ? `This card drills a whole opening line; the player plays ${side}'s moves from ${keyMv} to the end: ${numbered(line, line.length)}`
   : `The move to learn on this card: ${keyMv}. The card's full line: ${numbered(line, line.length)}`,
  card.played ? `What the player played in their own game at that point: ${card.played}` : "",
  card.keyNote ? `Card summary: ${card.keyNote}` : "", notes ? "Notes on the line:\n" + notes : "",
  "", `Question: ${q}`,
 ].filter((x) => x !== "").join("\n");
}
async function runExplain() {
 if (!sampleFn || !card) return;
 if (mode === "drill" && !done && !practice) slip(pos, "you asked for an explanation");
 exCtl?.abort(); exCtl = new AbortController();
 const out = $("exout"); out.textContent = "Thinking…"; $("exgo").disabled = true; $("exstop").hidden = false;
 try {
  await sampleFn(explainPrompt($("exq").value.trim()), { signal: exCtl.signal, onText: ({ text }) => { out.textContent = text; } });
 } catch (e) {
  out.textContent = e.text || "";
  const msg = { no_key: "Add an AI key in Settings to get explanations.", bad_key: "The AI provider rejected your key. Check it in Settings.", not_granted: "Explanations aren't available.", rate_limited: "Too many questions just now. Try again in a minute.",
   sampling_disabled: "Claude isn't available on this account.", refused: "Claude couldn't answer that one. Try rephrasing." }[e.code];
  if (e.code !== "cancelled" && e.message && !["no_key"].includes(e.code)) console.warn(e.message);
  if (e.code !== "cancelled") out.textContent += (out.textContent ? "\n\n" : "") + (msg || "Something went wrong. Try again.");
 } finally { $("exgo").disabled = false; $("exstop").hidden = true; }
}
$("analyse").addEventListener("click", () => { if (mode === "drill" && !done && !practice && card) slip(pos, "you opened the engine"); });
$("explain").onclick = () => { const box = $("exbox"); if (box.hidden) { box.hidden = false; runExplain(); } else { box.hidden = true; exCtl?.abort(); } };
$("exgo").onclick = runExplain;
$("exstop").onclick = () => exCtl?.abort();
$("exq").addEventListener("keydown", (e) => { if (e.key === "Enter") runExplain(); });
$("q").addEventListener("input", () => { shown = 20; renderList(); });
$("more").onclick = () => { shown += 20; renderList(); };
$("rand").onclick = () => {
 if (card && mode === "drill" && !practice && !done) queue.unshift(card.id); // don't lose the card you were on
 const c = randomCard(); if (c) load(c, "drill", true);
};
function human(ms) { const h = ms / 3600e3; return h < 24 ? h + " hours" : h < 168 ? h / 24 + " days" : h < 720 ? h / 168 + (h === 168 ? " week" : " weeks") : h / 720 + (h === 720 ? " month" : " months"); }

$("board").addEventListener("click", (e) => {
 const d = e.target.closest(".sq"); if (!d || !card || busy || !isMyTurn()) return;
 if (view !== pos) { go(pos); return; }
 const n = d.dataset.sq, p = game.get(n);
 if (sel && sel !== n && game.moves({ square: sel, verbose: true }).some((m) => m.to === n)) { tryMove(sel, n); return; }
 sel = p && p.color === game.turn() ? (sel === n ? null : n) : null; draw(); drawArrows();
});
$("hint").onclick = () => { if (!isMyTurn()) return; slip(pos, "you used a hint"); const m = moveOf(pos); sel = m.from; say("", "Hint", `Move the piece on ${m.from}.`); draw(); drawArrows(); };
$("show").onclick = () => { if (!isMyTurn()) return; slip(pos, "you asked for the answer"); const m = moveOf(pos); ARROWS = [[m.from, m.to, "#1f9a5c"]]; say("bad", "Answer", `${line[pos]}. Play it to continue.`); draw(); drawArrows(); };
$("next").onclick = () => nextCard();
$("retry").onclick = () => { if (card) load(card, "drill", true); };
$("b0").onclick = () => go(0); $("b1").onclick = () => go(view - 1); $("b2").onclick = () => go(view + 1);
$("b3").onclick = () => go(done || mode === "study" ? line.length : pos);
$("bf").onclick = () => { orient = orient === "w" ? "b" : "w"; draw(); drawArrows(); };
document.addEventListener("keydown", (e) => {
 if (!card || (e.target.closest && e.target.closest("input,textarea"))) return;
 const k = { ArrowLeft: () => go(view - 1), ArrowRight: () => go(view + 1), Home: () => go(0), End: () => $("b3").onclick(), f: () => $("bf").onclick() }[e.key];
 if (k) { k(); e.preventDefault(); }
});

// ---------- sessions ----------
const inDeck = (c) => (deck === "all" ? c.deck !== "archive" : c.deck === deck);
const isDue = (c) => P[c.id] && P[c.id].d <= Date.now();
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function startSession() {
 const cs = CARDS.filter(inDeck);
 // Due cards and a random handful of new ones, shuffled together so no card is always first.
 const due = cs.filter(isDue).map((c) => c.id);
 const fresh = shuffle(cs.filter((c) => !P[c.id]).map((c) => c.id)).slice(0, NEW_PER_SESSION);
 queue = shuffle(due.concat(fresh)); newLeft = NEW_PER_SESSION;
 const last = store.get("drill-last");
 if (queue.length > 1 && queue[0] === last) queue.push(queue.shift());
 nextCard();
}
function requeue(id) {
 // A missed card comes back this session, but at least 3 cards later (or last, if fewer are left).
 const at = queue.length <= 3 ? queue.length : 3 + Math.floor(Math.random() * (queue.length - 2));
 queue.splice(at, 0, id);
}
function randomCard() {
 const cs = CARDS.filter(inDeck).filter((c) => !card || c.id !== card.id);
 return cs[Math.floor(Math.random() * cs.length)];
}
function nextCard() {
 const id = queue.shift();
 if (!id) {
  const cs = CARDS.filter(inDeck), soon = cs.filter((c) => P[c.id]).sort((a, b) => P[a.id].d - P[b.id].d)[0];
  card = card || randomCard(); if (card) load(card, "study");
  say("good", "Session done", "Nothing due right now." + (soon ? ` Next card is due ${new Date(P[soon.id].d).toLocaleString()}.` : "") + (cs.some((c) => !P[c.id]) ? " Pick the deck again to start more new cards." : ""));
  return;
 }
 store.set("drill-last", id);
 load(BY[id], "drill");
}

// ---------- shelves ----------
function deckCounts(id) {
 const cs = CARDS.filter((c) => (id === "all" ? c.deck !== "archive" : c.deck === id)), now = Date.now();
 return { n: cs.length, due: cs.filter((c) => P[c.id] && P[c.id].d <= now).length, fresh: cs.filter((c) => !P[c.id]).length, known: cs.filter((c) => P[c.id] && P[c.id].l >= 3).length, seen: cs.filter((c) => P[c.id]).length };
}
function renderDecks() {
 const all = [{ id: "all", name: "Everything", blurb: "Every deck except the archive, mixed." }].concat(DATA.decks);
 $("decks").innerHTML = all.map((d) => { const k = deckCounts(d.id);
  return `<button class="deck" data-id="${d.id}" aria-pressed="${d.id === deck}"><b></b><span></span>` +
   `<div class="bar"><i class="k" style="width:${k.n ? k.known / k.n * 100 : 0}%"></i><i class="s" style="width:${k.n ? (k.seen - k.known) / k.n * 100 : 0}%"></i></div>` +
   `<div class="counts">${k.n} cards · ${k.due} due · ${k.fresh} new · ${k.known} learned</div></button>`; }).join("");
 [...$("decks").children].forEach((b, i) => { b.querySelector("b").textContent = all[i].name; b.querySelector("span").textContent = all[i].blurb;
  b.onclick = () => { deck = b.dataset.id; store.set("drill-deck", deck); renderDecks(); renderList(); startSession(); window.scrollTo({ top: 0, behavior: "smooth" }); }; });
 renderStats();
}
let shown = 20, lastListDeck = null;
function renderList() {
 if (lastListDeck !== deck) { shown = 20; lastListDeck = deck; }
 const q = $("q").value.trim().toLowerCase(), now = Date.now();
 const all = CARDS.filter(inDeck).filter((c) => !q || (code(c) + " " + c.title + " " + (c.sub || "") + " " + (c.game ? c.game.opp : "")).toLowerCase().includes(q));
 const cs = all.slice(0, shown);
 $("lh").textContent = deck === "all" ? "All cards" : "Cards in " + DATA.decks.find((d) => d.id === deck).name;
 $("more").hidden = all.length <= shown;
 $("more").textContent = `Show ${Math.min(20, all.length - shown)} more (${all.length - shown} left)`;
 $("lcount").textContent = all.length ? `Showing ${cs.length} of ${all.length}` : "No cards match.";
 $("list").innerHTML = cs.map((c) => { const p = P[c.id];
  const tag = !p ? '<span class="tag">new</span>' : p.d <= now ? '<span class="tag due">due</span>' : `<span class="tag ${p.l >= 3 ? "k" : ""}">level ${p.l}</span>`;
  return `<button class="li" data-id="${c.id}"><div><div class="t"></div><div class="s"></div></div>${tag}</button>`; }).join("");
 [...$("list").children].forEach((b, i) => { b.querySelector(".t").textContent = code(cs[i]) + "  " + cs[i].title; b.querySelector(".s").textContent = (cs[i].sub || "") + (cs[i].archived ? ` · archived ${cs[i].archived}` : "");
  b.onclick = () => { load(cs[i], "study"); window.scrollTo({ top: 0, behavior: "smooth" }); }; });
}
// ---------- progress ----------
function pct(a, b) { return b ? Math.round(100 * a / b) + "%" : "–"; }
function renderStats() {
 const ps = Object.entries(P).filter(([id]) => BY[id]);
 let right = 0, wrong = 0; const ev = [];
 ps.forEach(([id, p]) => { right += p.r || 0; wrong += p.w || 0; (p.h || []).forEach(([t, ok]) => ev.push({ id, t, ok })); });
 const now = Date.now(), wk = 7 * 864e5;
 const inW = (a, b) => ev.filter((e) => e.t > now - a && e.t <= now - b);
 const tw = inW(wk, 0), lw = inW(2 * wk, wk), okc = (xs) => xs.filter((e) => e.ok).length;
 const learned = CARDS.filter((c) => P[c.id] && P[c.id].l >= 3).length;
 const facts = [
  [String(right + wrong), "scheduled reviews done"],
  [pct(right, right + wrong), "solved first try, all time"],
  [pct(okc(tw), tw.length), `first try this week (${tw.length} review${tw.length === 1 ? "" : "s"})` + (lw.length ? `, vs ${pct(okc(lw), lw.length)} the week before` : "")],
  [String(learned), "cards learned (solved first try 3+ times in a row)"],
 ];
 $("pfacts").innerHTML = facts.map(() => '<div class="fact"><b></b><span></span></div>').join("");
 [...$("pfacts").children].forEach((el, i) => { el.querySelector("b").textContent = facts[i][0]; el.querySelector("span").textContent = facts[i][1]; });
 const row = (label, ok, n) => `<div class="r"><span>${label}</span><div class="m"><i style="width:${n ? 100 * ok / n : 0}%"></i></div><span class="v">${n ? pct(ok, n) + " of " + n : "none yet"}</span></div>`;
 const weeks = [];
 for (let k = 7; k >= 0; k--) { const xs = inW((k + 1) * wk, k * wk); const d = new Date(now - (k + 1) * wk + 864e5); weeks.push(row(k ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "This week", okc(xs), xs.length)); }
 $("pweeks").innerHTML = ev.length ? weeks.join("") : '<p class="status">Weekly history starts with your next review.</p>';
 $("pdecks").innerHTML = DATA.decks.map((d) => { let r = 0, w = 0; ps.forEach(([id, p]) => { if (BY[id].deck === d.id) { r += p.r || 0; w += p.w || 0; } }); return row(d.name, r, r + w); }).join("");
 const miss = ps.filter(([, p]) => p.w).sort((a, b) => b[1].w - a[1].w).slice(0, 5);
 $("pmiss").innerHTML = miss.length ? miss.map(() => '<button class="li"><div><div class="t"></div><div class="s"></div></div><span class="tag due"></span></button>').join("") : '<p class="status">No misses yet.</p>';
 [...$("pmiss").querySelectorAll(".li")].forEach((b, i) => { const [id, p] = miss[i], c = BY[id];
  b.querySelector(".t").textContent = c.title; b.querySelector(".s").textContent = `${p.w} missed, ${p.r || 0} solved first try`; b.querySelector(".tag").textContent = "study";
  b.onclick = () => { load(c, "study"); window.scrollTo({ top: 0, behavior: "smooth" }); }; });
}
function renderFacts() {
 $("facts").innerHTML = DATA.facts.map(() => '<div class="fact"><b></b><span></span></div>').join("");
 [...$("facts").children].forEach((el, i) => { el.querySelector("b").textContent = DATA.facts[i][0]; el.querySelector("span").textContent = DATA.facts[i][1]; });
 $("method").textContent = DATA.method;
 $("hsub").textContent = DATA.subtitle;
}

// ---------- boot: the host app calls DrillApp.start(data, hooks) ----------
window.DrillApp = {
 start(d, hooks = {}) {
  HOOKS = hooks;
  sampleFn = hooks.explain || null; $("explain").hidden = !sampleFn;
  if (hooks.progress) P = hooks.progress;
  DATA = d; CARDS = d.cards; BY = {}; CARDS.forEach((c) => (BY[c.id] = c));
  const bad = [];
  CARDS.forEach((c) => { const g = new Chess(c.fen0 || undefined); for (const s of c.moves) if (!g.move(s, { sloppy: true })) { bad.push(c.id); break; } });
  if (bad.length) { console.error("Bad lines", bad); CARDS = CARDS.filter((c) => !bad.includes(c.id)); }
  const sd = store.get("drill-deck"); deck = sd && (sd === "all" || d.decks.some((x) => x.id === sd)) ? sd : "all";
  $("hsub").hidden = false; renderFacts(); renderDecks(); renderList(); card = null; startSession();
 },
 /** Merge in progress that arrived from another device. */
 setProgress(p) { P = p; store.set("drill-progress", JSON.stringify(P)); if (DATA) { renderDecks(); renderList(); } },
 setStatus(t) { $("status").textContent = t; },
 setExplain(fn) { sampleFn = fn || null; $("explain").hidden = !sampleFn; },
};
if (typeof Chess === "undefined") { $("cmeta").innerHTML = '<span class="err">The chess library didn\'t load. Reload the page.</span>'; }
}
