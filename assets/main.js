
// Make connection
var socket = io.connect('http://localhost:3000');
suppresser = false;

//draw

var activeLine;
var drawSocketData;

var undo = document.querySelector('#undo');
var redo = document.querySelector('#redo');
var clear = document.querySelector('#clear');
var formControlRange=document.querySelector('#formControlRange');
var colorInput = document.querySelector('#colorInput');
var rangeLabel = document.querySelector('#rangeLabel');

var svgSelector = document.querySelector('#svg-draw');
var redoBuffer = [];

formControlRange.addEventListener('change', ()=>{
    rangeLabel.textContent="Line: "+formControlRange.value+"px";
})

var renderPath = d3.svg.line()
    .x(function (d) { return d[0]; })
    .y(function (d) { return d[1]; })
    .tension(0)
    .interpolate("cardinal");

var svg = d3.select("svg")
    .call(d3.behavior.drag()
        .on("dragstart", dragstarted)
        .on("drag", dragged)
        .on("dragend", dragended));

function dragstarted() {
    if (drawSocketData) {
        activeLine = svg.append("path").datum([])
        .attr("class", "line")
        .attr('stroke',drawSocketData.color)
        .attr('stroke-width',drawSocketData.width); 
    
        activeLine.datum().push(drawSocketData.data);
        drawSocketData = null;
        return;
    }
    activeLine = svg.append("path").datum([])
    .attr("class", "line")
    .attr('stroke',colorInput.value)
    .attr('stroke-width',formControlRange.value); 
    
    let t = d3.mouse(this);
    activeLine.datum().push(t);
    socket.emit('dragstart', {data:t,color:colorInput.value,width:formControlRange.value});
}

function dragged() {
    if (drawSocketData) {
        activeLine.datum().push(drawSocketData);
        activeLine.attr("d", renderPath);
        drawSocketData = null;
        return;
    }
    let t = d3.mouse(this);
    activeLine.datum().push(t);
    activeLine.attr("d", renderPath);
    socket.emit('dragged', t);
}

function dragended() {
    activeLine = null;
    socket.emit('dragend');
    socket.emit('svgdata', svgSelector.innerHTML);
}

socket.on('dragged', (data) => {
    drawSocketData = data;
    dragged();
});
socket.on('dragstart', (data) => {
    drawSocketData = data;
    dragstarted();
});
socket.on('dragend', () => {
    activeLine = null;
});
socket.on('svgdata', (data) => {
    svgSelector.innerHTML=data;
});

function undoListner(t) {
    if(t) socket.emit('undo');
    let lastChild = svgSelector.lastChild;
    if (lastChild) {
        redoBuffer.unshift(lastChild);
        svgSelector.removeChild(lastChild);
    }
};   
function redoListner(t){
    if(t) socket.emit('redo');
    if (redoBuffer.length) {
        let t = svgSelector.firstChild;
        let popped = redoBuffer.pop();
        if (t)
            svgSelector.insertBefore(popped, t);
        else
            svgSelector.appendChild(popped);
    }
};  
function clearListner(t){
    if(t) socket.emit('clear');
    svgSelector.innerHTML='';
}; 

socket.on('redo', redoListner);
socket.on('undo', undoListner);
socket.on('clear', clearListner);
undo.addEventListener('click', undoListner);
redo.addEventListener('click', redoListner);
clear.addEventListener('click', clearListner);


//quill
var quill = new Quill('#editor', {
    modules: { toolbar: '#toolbar-container' },
    theme: 'snow'
});

socket.on('updated_para', function (data) {
    var ops = JSON.parse(data);
    quill.updateContents(ops.ops);
});

socket.on('html', function (data) {
    var qlEditor = document.querySelector('.ql-editor');
    suppresser = true;
    qlEditor.innerHTML = data;
});

var imageLink = document.querySelector('.ql-image');
imageLink.addEventListener('click', () => {
    var range = this.quill.getSelection();
    var value = prompt('What is the image URL');
    if (value) {
        this.quill.insertEmbed(range.index, 'image', value, Quill.sources.USER);
    }
});

quill.on('text-change', function (delta, oldDelta, source) {
    if (suppresser) { suppresser = false; return; }
    if (source == 'user') {
        var para = quill.getContents();
        socket.emit('para', { delta: JSON.stringify(delta) });
        Promise.resolve().then(() => {
            let str = quill.container.innerHTML;
            let html = str.slice(str.indexOf('>') + 1, str.indexOf('</div><div class="ql-clipboard"'))
            socket.emit('html', html);
        });
    }

});

// chat
var message = document.getElementById('message'),
    handle = document.getElementById('handle'),
    btn = document.getElementById('send'),
    output = document.getElementById('output'),
    feedback = document.getElementById('feedback');

btn.addEventListener('click', function () {
    socket.emit('chat', {
        message: message.value,
        handle: handle.value
    });
    message.value = "";
});

message.addEventListener('keypress', function () {
    socket.emit('typing', handle.value);
})

socket.on('chat', function (data) {
    feedback.innerHTML = 'Chat';
    output.innerHTML += '<strong class="text-info">' + data.handle + ': </strong>' + '<p class="text-muted text-break">' + data.message + '</p>';
    output.scrollTop = output.scrollHeight;
});

socket.on('typing', function (data) {
    feedback.innerHTML = '<small><em>' + data + ' typing..</em></small>';
    setTimeout(() => { feedback.innerHTML = 'Chat'; }, 1000);
});

//iframe

let iframe = document.getElementById('screen-iframe');
let iframeBtn = document.getElementById('btn-iframe');
iframeBtn.addEventListener('click', () => {
    if (iframe.style.position == 'static') {
        iframe.style.background = '#373b3fe8'
        iframe.style.position = 'fixed';
    }
    else {
        iframe.style.background = 'none'
        iframe.style.position = 'static';
    }
});

//code-editor

var editor = ace.edit("code-editor");
editor.setTheme("ace/theme/monokai");
editor.session.setMode("ace/mode/javascript");

const codeDocument = document.querySelector('#code-document');
const codeTheme = document.querySelector('#code-theme');
const codeEditor = document.querySelector('#code-editor');

codeDocument.addEventListener('change', (event) => {
    editor.session.setMode("ace/mode/" + event.target.value);
});

codeTheme.addEventListener('change', (event) => {
    editor.setTheme("ace/theme/" + event.target.value);
});

socket.on('doc', (data) => {
    editor.setValue(data);
});

codeEditor.addEventListener("keyup", () => {
    socket.emit('editDoc', editor.getValue());
});
