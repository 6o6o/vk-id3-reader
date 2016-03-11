var observer = new WebKitMutationObserver(function(mutations) {
	mutations.forEach(function(mutation) {
		for (var i = 0; i < mutation.addedNodes.length; i++) {
			var n = mutation.addedNodes[i];
			if (n.nodeType === 1 && n.children.length) {
				audioGrab(n);
			}
		}
	})
});
function audioGrab(n) {
	var audio = !n.classList.contains('audio') ? n.getElementsByClassName('audio') : [n];
	for (var j = 0; j < audio.length; j++) {
		if(!audio[j].classList.contains('tag')) {
			audio[j].classList.add('tag');
			attachNode(audio[j]);
		}
	}
}

function attachNode(node) {
	var prt = node.getElementsByClassName('info')[0] || node.children[0],
	localTag;
	if(prt.id) {
		var ctrl = ['prev',,'next'], btn = document.createElement('div');
		for (var i=0; i<ctrl.length; i++) {
			ctrl[i] = ctrl[i] ? mkBtn(ctrl[i], function() {
				 callDoc('audioPlayer.'+this.classList[0]+'Track(1)');
			}) : mkBtn('scrak', function() {
				var id = prt.getElementsByTagName('a')[0].outerHTML;
				id = id.substring(id.indexOf("('")+2,id.indexOf("',"));
				setTimeout(function() { callDoc('audioPlayer.scrollToTrack("'+id+'")'); });
			});
			btn.appendChild(ctrl[i]);
		}
		btn.className = 'controls';
		callDoc("ga('send', 'event', 'audio', 'play')");
	} else {
		var title = node.querySelector('.title_wrap').children,
		inp = node.getElementsByTagName('input')[0],
		val = inp ? inp.value.split(',') : false,
		act = prt.querySelector('.actions'),
		btn = mkBtn('id3btn', function(e) {
			canEvt(e);
			var xpd = node.children[node.children.length-1];
			if(!btn.classList.contains('spin')) {
				if(xpd.classList.contains('xpd')) {
					id3.popup(xpd,btn);
				} else if(btn.classList.contains('done')){
					id3.detach(btn, node);
				} else {
					var tag = {len: '', dur: val[1]};
					btn.classList.add('spin');
					id3.state(btn, 0, 'Reading file...');
					ajax('GET', val[0], {onprogress: function(e){
						var bin = this.response;
						tag.total = e.total;
						//console.log(bin.length);
						if(!tag.bin && bin.length > 9) {
							tag.bin = bin.substr(0,10);
							if(tag.bin.substr(0,3) == 'ID3') {
								for(var i=6; i<10; i++)
									tag.len += ('000000'+tag.bin.charCodeAt(i).toString(2)).substr(-7);
								tag.len = parseInt(tag.len, 2)+10;
								//console.log(tag.len, ' <- taglen');
							} else {
								if(this.status == 404) id3.state(btn, 1, '404 File not found');
								else {
									id3.state(btn, 'verbal', id3.calc(tag, 'No ID3v2 tag found'));
									id3.store(node.id, {head: tag});
								}
								this.abort();
							}
						}
						if(tag.len && bin.length > tag.len) {
							var id3bin = new Uint8Array(tag.len);
							for(var i=0; i<tag.len; i++) id3bin[i] = bin.charCodeAt(i);
							ajax('POST', id3.host+'vk/tagparse.php', {onload: function() {
								if(this.status == 200) {
									var id3tag = JSON.parse(this.responseText);
									id3.constr(id3tag, btn, tag);
									id3tag.head = tag;
									id3.store(node.id, id3tag);
								} else if(this.status == 500){
									id3.state(btn, 1, id3.calc(tag, 'Fatal Error: Corrupt tag'));
								}
							}}, id3bin.buffer);
							id3.state(btn, 0, id3.calc(tag, 'Processing tag...'));
							this.abort();
						}
					}});
					var curpg = location.pathname + location.search + location.hash;
					callDoc("ga('send', 'event', 'audio', 'rip', '"+btn.download+"', {page:'"+curpg+"'})");
				}
			}
		}, node.id);
		if(val[0]) btn.href = val[0].split('?')[0];
		else setTimeout(function() { id3.state(btn, 1, 'Copyrighted material: access denied', canEvt); });
		if(act && act.children.length > 1) {
			prt.insertBefore(mkBtn('cut', id3.actions), act);
			act.onmouseout = id3.actions;
		}
		title = title[0].innerText+' - '+title[1].innerText;
		btn.download = title.replace(/\./g, '');
		localTag = id3.store(node.id);
	}
	prt.appendChild(btn);
	if(localTag) {
		localTag = JSON.parse(localTag);
		id3.constr(localTag, btn);
	}
}
function ajax(method, query, handler, data) {
	var xhr = new XMLHttpRequest();

	xhr.overrideMimeType('text/plain; charset=x-user-defined');
	for(var a in handler) xhr[a] = handler[a];
	xhr.open(method, query, true);
	xhr.send(data);
}
function canEvt(e) {
	e.cancelBubble = true;
	if(e.target.classList.contains('btn')) e.preventDefault();
}
function isDes(o, mrk) {
	if(mrk.split) mrk = mrk.split(' ');
	loop:while (o.parentNode) {
		for (var i=0; i<mrk.length; i++) {
			if(o.classList.contains(mrk[i].nodeType ? null : mrk[i]) || o.id === mrk[i] || o === mrk[i])
				break loop;
		}
		o = o.parentNode;
	}
	return o.parentNode ? o : null;
}
function mkBtn(cls, cck, tip) {
	var a = document.createElement('a');
	if(cls) a.className = cls+' btn';
	if(cck) a.onclick = cck;
	if(tip) a.onmouseover = function() {
		id3.tooltip(this, id3.title, 10);
	};
	return a;
}
function callDoc(s, perm) {
	var scr = document.createElement("script");
	scr.innerHTML = s;
	document.head.appendChild(scr);
	if(!perm) scr.parentNode.removeChild(scr);
}
function enclose(fn, arg) {
	return function() {
		fn(arg);
	}
}
var id3 = {
host: '//boy.co.ua/',
pict: ['','fl_l','fl_r','clr'],
struct: ['','xpd','tag','clr'],
title: 'ID3v2 info',
akey: function(aid, prefix) {
	if(!aid) return;
	prefix = prefix || '';
	var ids = aid.match(/-?\d+/g);
	return prefix+ids[0]+'_'+ids[1];
},
detach: function(btn, anode) {
	id3.tooltip(btn);
	var xpd = anode.querySelector('.xpd');
	if(xpd) {
		id3.popup(xpd, btn);
		anode.removeChild(xpd);
	}
	btn.parentNode.removeChild(btn);
	id3.store(anode.id, 1);
	attachNode(anode);
},
calc: function(o, msg) {
	msg = msg ? ' | '+msg : '';
	var taglen = o.len || 0;
	var nfo = Math.min(Math.floor((o.total-taglen)*8/o.dur/1000),320)+'kbps';
	return nfo+' '+id3.sz(o.total)+msg;
},
tooltip: function(btn, msg, pos) {
	var getBtn = "geByClass1('id3btn','"+isDes(btn,'audio').id+"')";
	callDoc("window.tooltips && tooltips.destroy("+getBtn+")");
	btn.onmouseover = function() { callDoc("audioTag.tip("+getBtn+", '"+msg+"', ["+pos+", 6, 0])"); };
	if(btn.parentNode.querySelector('.id3btn:hover')) btn.onmouseover();
},
actions: function(e) {
	var elem = this;
	if(e.type != 'click') {
		if(isDes(e.relatedTarget, [this]))
			return;
		elem = this.previousSibling;
	} else canEvt(e);
	elem.classList.toggle('open');
},
state: function(ic, arg, msg, cck) {
	ic.classList.add('done');
	if(cck) ic.onclick = cck;
	if(msg) {
		if(ic.onmouseover) {
			id3.tooltip(ic, msg, 10);
		} else ic.title = msg;
	}
	if(arg) {
		ic.classList.remove('spin');
		if(arg.split) {
			ic.classList.add.apply(ic.classList, arg.split(' '));
			ic.innerHTML = '<b>'+parseInt(msg)+'</b>kbps';
			for(var i=0; i<ic.children.length; i++)
			ic.children[i].onclick = function() {
				return false;
			};
		} else ic.style.backgroundPositionY = arg*12.5+75+'%';
	}
},
popup: function(xpd, ic) {
	//console.log(isDes(xpd,'audio').offsetWidth);
	var tag = xpd.firstChild;
	if(!xpd.style.height || xpd.style.height == '0px') {
		xpd.style.height = (tag.offsetHeight)+'px';
	} else {
		xpd.style.height = '0px';
	}
	if(isDes(xpd,'pad_playlist initial_list')) {
		var i = 0, aid = xpd.parentNode.id,
		sortir = setInterval(function () {
			if(i++>10) clearInterval(sortir);
			callDoc('Audio.updateSorterRows(ge("'+aid+'"))');
		},33);
		if(!xpd.onmousedown) xpd.onmousedown = canEvt; // cancel drag
	}
},
constr: function(id3tag, btn, o) {
	var buf = '<table>', tag = [], c = 0, i,
	audioNode = isDes(btn, 'audio');
	o = o || id3tag.head;
	for(i=0;i<4;i++) {
		tag[i] = document.createElement('div');
		if(i) tag[i].className = id3.struct[i];
	}
	if(id3tag.res) {
		var id3ver = 'ID3v2.'+id3tag.res.ver;
		buf += '<tr><th colspan="2">'+id3ver+'<a>&#10008;</a><span>'+id3.calc(o)+'</span></th></tr>';
		for(i in id3tag.res) if(i.length > 3) {
			if(i != 'apic') {
				c++;
				buf += (c%2) ? '<tr><td>' : '<tr class="ev"><td>';
				buf += id3.frames[i]+'</td><td>'+id3tag.res[i]+'</td></tr>';
			} else id3.attachPic(tag[2], id3tag.res[i], audioNode);
		}
		buf = buf.replace(/\r?\n|\r/g,"<br/>");
		buf = buf.replace(/\b(?:\w+:\/\/)?[\w.\-:@]+\.[a-zA-Z]{2,6}(?:\/[\w!\x23-\x2f~=:?]*)?\b/g,id3.linker);
		buf += '</table>';
		tag[0].innerHTML = buf;
		tag[2].appendChild(tag[0].firstChild);
		tag[2].appendChild(tag[3]);
		tag[1].appendChild(tag[2]);
		tag[1].onclick = canEvt; // cancel wall
		tag[1].querySelector('th a').onclick = function(){
			id3.detach(btn, audioNode);
		};
		audioNode.appendChild(tag[1]);
		id3.state(btn, 'verbal hastag', id3.calc(o, id3ver));
		if(!id3tag.head) id3.popup(tag[1], btn);
	} else id3.state(btn, 'verbal', id3.calc(o, id3tag.fail));
},
attachPic:function (tag,param,anode) {
param = param.split(';');
var aid = anode.id,
maxWid = anode.offsetWidth,
totWid = 0;
for(var z=0;z<param.length;z++) {
	var pic = document.createElement('img'),
	pbr = document.createElement('div'),
	lnk = document.createElement('a'),
	nfo = param[z].split('.'),
	tip = [],
	path = id3.host+'tmp/'+nfo[0]+'.'+nfo[1],
	natWid = nfo[3],
	x = 0,k,i;
	pic.src = lnk.href = path;
	lnk.target = '_blank';
	pbr.className = 'pbr';
	if(nfo[2]>0) {
	for(k=0;k<2;k++) {
		tip[k] = [];
		for(i=0;i<3;i++) {
			tip[k][i] = document.createElement('div');
			if(i) {
				tip[k][i].className = id3.pict[i]+' tip';
				tip[k][0].appendChild(tip[k][i]);
			} else {
				tip[k][i].className = 'pictip';
				pbr.appendChild(tip[k][i]);
			}
		}
	}
	tip[0][1].innerHTML = nfo[3]+'x'+nfo[4];
	tip[0][2].innerHTML = id3.sz(nfo[2])+' '+nfo[1].toUpperCase();
	tip[1][1].innerHTML = nfo[5]<21 ? id3.pictyp[nfo[5]] : 'Unknown';
	tip[1][2].innerHTML = '&#8803;';
	tip[1][2].onclick = enclose(callDoc, "audioTag.postbox(['//vk.com/"+aid+"','"+path+"'])");
	tip[1][2].onmouseover = enclose(callDoc, "audioTag.tip("+
		"document.querySelector('#"+aid+" .tip:hover'),"+
		"'Post to wall image + track',"+
		"[8, 6, 0])");
	while(nfo[3]>300) nfo[3] /= 2;
	if(nfo[5] == 17 || maxWid<200) {
		if(natWid>maxWid-24) nfo[3] = maxWid-24;
	} else if(maxWid>350 && maxWid<500 && nfo[3]>224) {
		nfo[3] = 224;
	}
	x = natWid/nfo[3];
	nfo[4] = nfo[5] == 17 ? 86 : nfo[4]/x;
	if(x!=1) tip[0][1].innerHTML += ' ('+Math.round(x*10)/10+'x)';
	tip[0][0].style.width = tip[1][0].style.width = nfo[3]+'px';
	pic.width = nfo[3];
	pic.height = nfo[4];
	}
	totWid += nfo[3]+10;
	if(z && z == param.length-1) {
		maxWid -= 8;
		var rw = Math.round(totWid / maxWid),
		diff = maxWid - (totWid % maxWid);
		if(diff/rw < 28) tag.classList.add('dbl');
	}
	lnk.appendChild(pic);
	pbr.appendChild(lnk);
	if(nfo[2]>0) for(i=0;i<3;i++) {
		pbr.childNodes[i].onmouseover = id3.trgtip;
		pbr.childNodes[i].onmouseout = id3.trgtip;
	}
	if(nfo[5] == 17) tag.insertBefore(pbr,tag.firstChild);
	else tag.appendChild(pbr);
}},
trgtip: function(e) {
	var pbr = isDes(e.target,'pbr').childNodes,
	on = e.type == 'mouseover' ? true : false;
	for(var k=0;k<2;k++) {
		pbr[k].style.visibility = on?'visible':'hidden';
		if(k && on && !pbr[k].style.marginTop) pbr[k].style.marginTop = pbr[2].firstChild.offsetHeight-pbr[k].offsetHeight+'px';
}},
linker: function(a) {
	var lnk,
	b = ' target="_blank"';
	if(a.indexOf('://')!=-1) lnk = a;
	else if(a.indexOf('@')!=-1 && a.indexOf(':')==-1) {
		lnk = 'mailto:'+a;
		b = '';
	}
	else lnk = 'http://'+a;
	return '<a href="'+lnk.toLowerCase()+'"'+b+'>'+a+'</a>';
},
sz: function(num) {
	var m = 1048576;
	if(num<m){
		if(num>1023) num = Math.round(num/1024*10)/10+'K';
		else num = num+'b';
	} else num = Math.round(num/m*100)/100+'M';
	return num;
},
store: function(aid, val) {
	var key = id3.akey(aid, 'tag');
	if(val) {
		if(val.head) {
			delete val.head.bin;
			if(!localStorage[key]) {
				localStorage[key] = JSON.stringify(val);
				id3.expireStorage(aid, true);
			}
		} else {
			localStorage.removeItem(key);
			id3.expireStorage(aid);
		}
	} else return localStorage[key];
},
expireStorage: function(aid, add) {
	var xkey = 'tag_timestamp';
	var tags = localStorage[xkey] || '{}';
	var ts = Math.floor(Date.now() / 1000);
	tags = JSON.parse(tags);
	aid = id3.akey(aid);
	if(add) {
		tags[aid] = ts;
	} else if(aid) {
		delete tags[aid];
	} else {
		for(var k in tags) {
			if(ts - tags[k] > 2592000
			|| k.indexOf('_') < 0) {
				delete tags[k];
				localStorage.removeItem('tag'+k);
			}
		}
	}
	localStorage[xkey] = JSON.stringify(tags);
},
frames: {
	tit2:"Title",
	tpe1:"Artist",
	talb:"Album",
	tyer:"Year",
	tcon:"Genre",
	comm:"Comment",
	tcom:"Composer",
	tope:"Original by",
	tcop:"Copyright",
	tenc:"Encoded by",
	tsse:"Parameters",
	trck:"Track #",
	tlen:"Length", // <-
	tpub:"Publisher",
	tpe2:"Additional\nperformers",
	tit1:"Category",
	uslt:"Lyrics",
	tlan:"Language",
	tdat:"Date", // <-
	popm:"Rating",
	ufid:"Unique ID",
	tpos:"Disk number",
	tdrc:"Year",
	tmed:"Media type",
	txxx:"Custom text",
	wxxx:"URL",
	wcom:"Where to buy",
	tit3:"Title annotation",
	text:"Lyricist",
	woar:"Official artist webpage",
	woaf:"Official audiofile webpage"
},
pictyp: [
		"&nbsp;",
		"Icon",
		"Other icon",
		"Front Cover",
		"Back Cover",
		"Leaflet",
		"Media",
		"Lead artist",
		"Artist",
		"Conductor",
		"Band/Orchestra",
		"Composer",
		"Lyricist",
		"Recording Location",
		"During recording",
		"During performance",
		"Video screen capture",
		"A bright coloured fish",
		"Illustration",
		"Artist logo",
		"Studio logo"
		]
}

callDoc('('+(function() {
audioTag = {
	ext: function(fn, ex) {
		return function() {
			fn();
			ex();
		}
	},
	receive: function(d,a) {
		d = d[2];
		if (d) {
			try {
				d = d.substr(d.indexOf('feed.init')+9);
				eval('(function(){ try { audioTag.opts = ' + d + ';})()');
				if(!cur.options) cur.options = {};
				cur.options.share = audioTag.opts.share;
				audioTag.postbox(a);
			}
			catch (e) { console.log(e); }
		}
		audioTag.getnext(a);
	},
	getnext: function(a) {
		var d = ajax.framedata;
		if (!(d || {}).length) return;
		if (d[0]) lTimeout(audioTag.receive.pbind(d.length > 1 ? d.shift() : 0, a), 0);
		else ajax.framedata = false;
	},
	postbox: function(res) {
		if(cur.options && cur.options.share && cur.options.share.timehash) {
			ga('send', 'event', 'audio', 'post');
			showWiki({w: 'postbox'}, false, event, {
				queue: 1,
				stat: [
					'wkview.js', 'wkview.css',
					'postbox.js', 'postbox.css',
					'wide_dd.js', 'wide_dd.css',
					'page.js', 'page.css'
				],
				onLoaded: function() {
					res.push('//chrome.google.com/webstore/detail/vk-id3-rdr/phgpcjgfakcnaofhjdkocljlifanlikm');
					audioTag.urlDone = composer.addMedia.onCheckURLDone;
					composer.addMedia.onCheckURLDone = function(c,d) {
						var o = d[2];
						if(o.url && o.url.indexOf('vk-id3-rdr') > 0) {
							o.images = [o.images[0]];
							document.querySelector('#pb_media_preview [id^=page_ldocs]').classList.add('left_void');
						}
						audioTag.urlDone(c,d);
						if(res.length) composer.addMedia.checkURL(location.protocol+res.shift());
					}
					composer.addMedia.checkURL(location.protocol+res.shift());
				}
			});
		} else ajax._post('/al_feed.php', {__query: "feed", al:-1}, {frame: 1, onDone:function(){
			audioTag.getnext(res);
		}});
	},
	tip: function(el, tt, sh) {
		if (!el) return;
		el.active = 1;
		animate(el, {opacity: 1}, 200);
		if (tt) showTooltip(el, {text: tt, showdt: 0, black: 1, shift: (sh ? sh : [12, 4, 0])});
	}
};

updGlobalPlayer = audioTag.ext(updGlobalPlayer, function() {
	var info = ge('gp_info');
	if(info) for(var i = 0; i < info.children.length; i++) {
		var name = info.children[i];
		if(!name.children.length && (name.scrollWidth > name.clientWidth)) {
			var runner = document.createElement('div');
			var dummy = document.createElement('span');
			dummy.innerHTML = name.innerHTML;
			runner.appendChild(dummy);
			runner.appendChild(dummy.cloneNode(true));
			runner.className = 'runline';
			runner.style.animationDuration = name.scrollWidth*0.04+'s';
			name.innerHTML = '';
			name.appendChild(runner);
		}
	}
});

(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
})(window,document,'script','//www.google-analytics.com/analytics.js','ga');

ga('create', 'UA-42569775-2', 'auto');
ga('send', 'pageview');
})+')();', true);

id3.expireStorage();
observer.observe(document, { childList: true, subtree: true });
audioGrab(document.body);