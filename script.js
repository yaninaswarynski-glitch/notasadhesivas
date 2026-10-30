(function(){
  var KEY='organizador-tareas-v1';
  var COLORS=['#fff2a8','#ffc9de','#bfe3ff','#ffd9a8','#c9f2d4'];
  var board=document.getElementById('board');
  var empty=document.getElementById('empty');
  var form=document.getElementById('form');
  var inMat=document.getElementById('materia'), inTask=document.getElementById('tarea'), inDate=document.getElementById('fecha');
  var msg=document.getElementById('msg');
  var notes=[];

  /* ---------- Fechas (hora local) ---------- */
  function pad(n){return n<10?'0'+n:''+n}
  function todayStr(){var d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
  function parseLocal(s){var p=s.split('-');return new Date(+p[0],+p[1]-1,+p[2])}
  function daysFromToday(s){
    var t=parseLocal(todayStr());
    return Math.round((parseLocal(s)-t)/86400000);
  }
  function updateMin(){inDate.min=todayStr()}
  updateMin();
  inDate.addEventListener('focus',updateMin);
  inDate.addEventListener('click',function(){
    updateMin();
    try{ if(inDate.showPicker) inDate.showPicker(); }catch(e){}
  });

  /* ---------- Almacenamiento ---------- */
  function save(){try{localStorage.setItem(KEY,JSON.stringify(notes))}catch(e){}}
  function load(){
    try{var raw=localStorage.getItem(KEY);if(raw){var a=JSON.parse(raw);if(Array.isArray(a))return a}}catch(e){}
    return [];
  }

  /* ---------- Render ---------- */
  function dueInfo(fecha){
    var d=daysFromToday(fecha);
    if(d<0) return {t:'Venció',c:'vencida'};
    if(d===0) return {t:'Vence hoy',c:'hoy'};
    if(d===1) return {t:'Vence mañana',c:''};
    var f=parseLocal(fecha).toLocaleDateString('es-AR',{weekday:'short',day:'numeric',month:'short'});
    return {t:'Vence '+f,c:''};
  }
  var TRASH='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/><path d="M10 11v6M14 11v6"/></svg>';

  function buildNote(n){
    var el=document.createElement('div');
    el.className='note';
    el.dataset.id=n.id;
    el.style.setProperty('--c',n.color);
    el.style.setProperty('--r',n.rot+'deg');
    el.style.left=n.x+'px'; el.style.top=n.y+'px';

    var mat=document.createElement('div');mat.className='mat';mat.textContent=n.materia;
    var task=document.createElement('div');task.className='task';task.textContent=n.tarea;
    var di=dueInfo(n.fecha);
    var due=document.createElement('div');due.className='due '+di.c;due.textContent=di.t;
    var del=document.createElement('button');
    del.type='button';del.className='del';del.innerHTML=TRASH;
    del.setAttribute('aria-label','Eliminar tarea de '+n.materia);
    del.addEventListener('click',function(){removeNote(n.id,el)});
    el.appendChild(mat);el.appendChild(task);el.appendChild(due);el.appendChild(del);

    el.addEventListener('pointerdown',function(e){startDrag(e,el,n)});
    board.appendChild(el);
    return el;
  }

  function refreshBoardSize(){
    var base=560, need=base, size=noteSize();
    notes.forEach(function(n){need=Math.max(need,n.y+size+40)});
    board.style.minHeight=need+'px';
    empty.style.display=notes.length?'none':'flex';
  }
  function noteSize(){return parseInt(getComputedStyle(document.documentElement).getPropertyValue('--size'))||172}

  function freeSlot(){
    var size=noteSize(), gap=18, w=board.clientWidth||600;
    var cols=Math.max(1,Math.floor((w-gap)/(size+gap)));
    for(var i=0;i<400;i++){
      var x=gap+(i%cols)*(size+gap), y=gap+Math.floor(i/cols)*(size+gap+4);
      var free=notes.every(function(n){return Math.abs(n.x-x)>size*.6||Math.abs(n.y-y)>size*.6});
      if(free) return {x:x,y:y};
    }
    return {x:gap,y:gap};
  }

  function removeNote(id,el){
    notes=notes.filter(function(n){return n.id!==id});
    save();
    el.classList.add('leaving');
    setTimeout(function(){el.remove();refreshBoardSize()},200);
  }

  /* ---------- Drag & drop con detección de límites ---------- */
  function startDrag(e,el,data){
    if(e.target.closest('button')) return;
    if(e.pointerType==='mouse'&&e.button!==0) return;
    e.preventDefault();
    var nr=el.getBoundingClientRect();
    var offX=e.clientX-nr.left, offY=e.clientY-nr.top;
    var outside=false;
    try{el.setPointerCapture(e.pointerId)}catch(err){}
    el.classList.add('dragging');
    board.classList.add('drag-on');
    // traer al frente
    board.appendChild(el);

    function isOutside(cx,cy){
      var br=board.getBoundingClientRect();
      return cx<br.left||cx>br.right||cy<br.top||cy>br.bottom;
    }
    function move(ev){
      var br=board.getBoundingClientRect();
      el.style.left=(ev.clientX-br.left-offX-6)+'px'; // 6 = borde de la pizarra
      el.style.top=(ev.clientY-br.top-offY-6)+'px';
      outside=isOutside(ev.clientX,ev.clientY);
      el.classList.toggle('will-delete',outside);
      board.classList.toggle('drag-out',outside);
    }
    function up(ev){
      el.removeEventListener('pointermove',move);
      el.removeEventListener('pointerup',up);
      el.removeEventListener('pointercancel',up);
      try{el.releasePointerCapture(e.pointerId)}catch(err){}
      board.classList.remove('drag-on','drag-out');
      el.classList.remove('dragging','will-delete');
      if(ev.type!=='pointercancel' && isOutside(ev.clientX,ev.clientY)){
        removeNote(data.id,el);
        return;
      }
      // dentro: ajustar a los límites y guardar
      var maxX=board.clientWidth-el.offsetWidth, maxY=board.clientHeight-el.offsetHeight;
      var x=Math.min(Math.max(0,parseFloat(el.style.left)||0),Math.max(0,maxX));
      var y=Math.min(Math.max(0,parseFloat(el.style.top)||0),Math.max(0,maxY));
      el.style.left=x+'px'; el.style.top=y+'px';
      data.x=Math.round(x); data.y=Math.round(y);
      save(); refreshBoardSize();
    }
    el.addEventListener('pointermove',move);
    el.addEventListener('pointerup',up);
    el.addEventListener('pointercancel',up);
    move(e);
  }

  /* ---------- Alta de tareas ---------- */
  function say(t){msg.textContent=t}
  form.addEventListener('submit',function(ev){
    ev.preventDefault();
    updateMin();
    var materia=inMat.value.trim(), tarea=inTask.value.trim(), fecha=inDate.value;
    if(!materia){say('Escribí el nombre de la materia.');inMat.focus();return}
    if(!tarea){say('Escribí la tarea pendiente.');inTask.focus();return}
    if(!fecha){say('Elegí una fecha límite.');inDate.focus();return}
    if(fecha<todayStr()){say('La fecha no puede ser anterior a hoy.');inDate.focus();return}
    var slot=freeSlot();
    var n={
      id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),
      materia:materia,tarea:tarea,fecha:fecha,
      color:COLORS[Math.floor(Math.random()*COLORS.length)],
      rot:(Math.random()*6-3).toFixed(1),
      x:slot.x,y:slot.y
    };
    notes.push(n);
    buildNote(n);
    save(); refreshBoardSize();
    say('');
    inTask.value='';inDate.value='';
    inTask.focus();
  });
  [inMat,inTask,inDate].forEach(function(i){i.addEventListener('input',function(){say('')})});

  /* ---------- Inicio ---------- */
  notes=load().filter(function(n){return n&&n.materia&&n.tarea&&n.fecha});
  notes.forEach(buildNote);
  refreshBoardSize();
})();
