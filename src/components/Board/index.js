// Initial states of using canvas in your project
// <canvas id="myCanvas" width:"300" height: "150"></canvas>
// const myCanvas = document.getElementById("myCanvas");
// const ctx = myCanvas.getContext("2d");

// The common way to draw on the canvas is to :
// 1. Begin a Path - beginPath()
// 2. Move to a Point - moveTo()
// 3. Draw in the Path - LineTo()
// 4. Draw the Path - stroke()

import { socket } from "@/socket";
import { MENU_ITEMS } from "@/constants";
import { useEffect, useLayoutEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { actionItemClick } from "@/slice/menuSlice";

const Board = () => {
  const canvasRef = useRef(null);
  const shouldDraw = useRef(false);

  const dispatch = useDispatch();
  const { activeMenuItem, actionMenuItem } = useSelector((state) => state.menu);
  const { color, size } = useSelector((state) => state.toolbox[activeMenuItem]);

  // for undo/redo
  const drawHistory = useRef([]);
  const historyPointer = useRef(0);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current; // it will give us event listeners and all other stuff
    const context = canvas.getContext("2d"); // context provides us all the utility functions for the canvas

    if (actionMenuItem === MENU_ITEMS.DOWNLOAD) {
      const URL = canvas.toDataURL();
      // console.log(URL); // it will provide us a long url we can paste it on google and see our image
      const anchor = document.createElement("a");
      anchor.href = URL;
      anchor.download = "sketch.jpg";
      anchor.click();
    } else if (
      actionMenuItem === MENU_ITEMS.UNDO ||
      actionMenuItem === MENU_ITEMS.REDO
    ) {
      if (historyPointer.current > 0 && actionMenuItem === MENU_ITEMS.UNDO)
        historyPointer.current -= 1;
      if (
        historyPointer.current < drawHistory.current.length - 1 &&
        actionMenuItem === MENU_ITEMS.REDO
      )
        historyPointer.current += 1;

      const imageData = drawHistory.current[historyPointer.current];
      context.putImageData(imageData, 0, 0);
    }
    dispatch(actionItemClick(null)); // again i could download the file for that i'll have to null it.
  }, [actionMenuItem, dispatch]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;

    const context = canvas.getContext("2d");

    const changeConfig = (color, size) => {
      context.strokeStyle = color; // color which we want to paint on the board throught the brush
      context.lineWidth = size; // width of the brush
    };

    const handleChangeConfig = (config) => {
      changeConfig(config.color, config.size);
    };

    changeConfig(color, size);
    socket.on("changeConfig", handleChangeConfig);

    return () => {
      socket.off("changeConfig", handleChangeConfig);
    };
  }, [color, size]);

  // before browser paint - it runs before useEffect
  // before useEffect runs we will set the height and width of canvas
  // pehle ham useEffect ko use kar rhe the but  hame hamare dono useEffect overlap kar rhe the properties and method ko
  useLayoutEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    // when mounting
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const beginPath = (x, y) => {
      context.beginPath();
      context.moveTo(x, y);
    };

    const drawLine = (x, y) => {
      context.lineTo(x, y);
      context.stroke();
    };

    // if i'm moving mouse it should not draw anything
    // whenever i press mouse and move then it should draw something
    // and as i leave/up mouse i should stop drawing anything
    const handleMouseDown = (e) => {
      shouldDraw.current = true;
      // context.beginPath();
      // context.moveTo(e.clientX, e.clientY);
      beginPath(e.clientX, e.clientY);

      // socket.io - cordinates bhejne ke liye
      socket.emit("beginPath", { x: e.clientX, y: e.clientY });
    };
    const handleMouseMove = (e) => {
      if (!shouldDraw.current) return;
      // context.lineTo(e.clientX, e.clientY);
      // context.stroke();
      drawLine(e.clientX, e.clientY);
      socket.emit("drawLine", { x: e.clientX, y: e.clientY });
    };
    const handleMouseUp = (e) => {
      shouldDraw.current = false;

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height); // how much area do i want to capture, i want to capture entire canvas
      drawHistory.current.push(imageData);
      historyPointer.current = drawHistory.current.length - 1; // my current pointer would be pointing very last
    };

    const handleBeginPath = (path) => {
      beginPath(path.x, path.y);
    };

    const handleDrawLine = (path) => {
      drawLine(path.x, path.y);
    };

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);

    socket.on("beginPath", handleBeginPath); // server se jo aaya hai usse ham yha print/show karenge
    socket.on("drawLine", handleDrawLine);

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseup", handleMouseUp);

      socket.off("beginPath", handleBeginPath);
      socket.off("drawLine", handleDrawLine);
    };
  }, []);

  return <canvas ref={canvasRef}></canvas>;
};

export default Board;

// client se server ko kuch bhejne ke liye ham socket.emit("beginPath", {x: e.clientX, y: e.clientY}) ka use karenge
// client me server ke data ko receive karne ke liye ham socket.on("beginPath", handleBeginPath) ka use karenge
// socket.broadcast.emit('beginPath', arg) // jo bhi ham draw kar rhe hai vhi ka vhi hame dekhne ko milega
