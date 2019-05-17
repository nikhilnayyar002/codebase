
// Make connection

var socket = io.connect('https://nikcodebase.herokuapp.com');

document.addEventListener("keydown",deleteListner);

//draw

var activeLine;
var drawSocketData;
var dashedValue='';
var lastSelectedPath=null;

var undo = document.querySelector('#undo');
var dashed = document.querySelector('#dashed');
var clear = document.querySelector('#clear');
var formControlRange=document.querySelector('#formControlRange');
var colorInput = document.querySelector('#colorInput');
var rangeLabel = document.querySelector('#rangeLabel');
var svgSelector = document.querySelector('#svg-draw');

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

var id=0;
function dragstarted() {
    function rtnActiveLine(color,width,id,data,dash) {
        let temp = svg.append("path").datum([])
        .attr("class", "line")
        .attr('stroke',color)
        .attr('stroke-width',width)
        .attr('id',"path-"+ id)
        .attr('stroke-dasharray',dash);
    
        temp.datum().push(data);
        return temp;
    }
    if (drawSocketData) {
        activeLine=rtnActiveLine(drawSocketData.color,drawSocketData.width,id++,drawSocketData.data,drawSocketData.dash);
        drawSocketData = null;
        return;
    }
    let t = d3.mouse(this);
    activeLine=rtnActiveLine(colorInput.value,formControlRange.value,id++,t,dashedValue);
    socket.emit('dragstart', {data:t,color:colorInput.value,width:formControlRange.value,dash:dashedValue});
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
    socket.emit('svgdata', svgSelector.innerHTML, id);
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
socket.on('svgdata', (data,idValue) => {
    svgSelector.innerHTML=data;
    id=idValue;
});
/*  
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
*/  
function undoListner(t) {
    if(t) socket.emit('undo');
    let lastChild = svgSelector.lastChild;
    if (lastChild) {
        svgSelector.removeChild(lastChild);
    }
}; 
function clearListner(t){
    if(t) socket.emit('clear');
    svgSelector.innerHTML='';
};
function dashedListner(t){
    if(dashedValue) {
        dashedValue='';
        t.target.classList.remove('active');
    } else {
        dashedValue='10';
        t.target.classList.add('active');
    }
};
function deleteListner(event){
    if(event.code=='Delete' && lastSelectedPath) {
        socket.emit('delete-path',lastSelectedPath.id);
        lastSelectedPath.parentElement.removeChild(lastSelectedPath);
        lastSelectedPath=null;
    }
    else if(!event.target){
        let temp=svgSelector.querySelector('#'+event);
        if(temp) 
            temp.parentElement.removeChild(temp);
        if(lastSelectedPath && lastSelectedPath.id==event)
            lastSelectedPath=null;
    }
}
socket.on('clear', clearListner);
socket.on('undo', undoListner);
socket.on('undo', undoListner);
socket.on('delete-path', deleteListner);
dashed.addEventListener('click', dashedListner);
undo.addEventListener('click', undoListner);
clear.addEventListener('click', clearListner);

svgSelector.addEventListener("click",(event)=>{
    let t=event.target;
    if(lastSelectedPath){
        lastSelectedPath.style.outline="none";
        lastSelectedPath.style.opacity='1';
        lastSelectedPath=null;
    }
    if(t.id.includes('path')) {
        t.style.outline="3px dashed #17a2b8";
        t.style.opacity='0.4';
        lastSelectedPath=t;
    }
});


//quill
var suppresser = false;
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

/*
#updates

@selection d3
https://bl.ocks.org/romsson/568e166d702b4a464347
http://bl.ocks.org/paradite/71869a0f30592ade5246
http://bl.ocks.org/lgersman/5311083

*/