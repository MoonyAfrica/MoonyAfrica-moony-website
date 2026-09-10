"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Copy, Eye, EyeOff, GripVertical, Plus, Trash2 } from "lucide-react";
import { AdminMediaPicker } from "@/components/admin-media-picker";
import { createCmsSection, type CmsSection, type CmsSectionItem, type CmsSectionType } from "@/lib/cms-types";

const blockTypes: { type:CmsSectionType; label:string; description:string }[] = [
  { type:"text", label:"Texte éditorial", description:"Surtitre, grand titre et paragraphe." },
  { type:"image_text", label:"Texte + image", description:"Bloc narratif avec image et bouton." },
  { type:"cards", label:"Cartes", description:"2 à 4 axes ou services." },
  { type:"stats", label:"Chiffres clés", description:"Indicateurs et impact." },
  { type:"cta", label:"Appel à l’action", description:"Bandeau avec bouton." },
  { type:"quote", label:"Citation", description:"Phrase forte ou manifeste." },
  { type:"faq", label:"FAQ", description:"Questions et réponses." },
  { type:"testimonials", label:"Témoignages", description:"Avis approuvés du Control Center." },
  { type:"partners", label:"Partenaires", description:"Logos des partenaires publiés." },
  { type:"newsletter", label:"Newsletter", description:"Formulaire d’inscription." },
  { type:"spacer", label:"Respiration", description:"Espace éditorial entre deux sections." },
];

const labels:Record<CmsSectionType,string>=Object.fromEntries(blockTypes.map(x=>[x.type,x.label])) as Record<CmsSectionType,string>;
const tonePreview:Record<NonNullable<CmsSection["background"]>,string>={ivory:"bg-[#fffaf4]",peach:"bg-[#f5e2d5]",terracotta:"bg-[#b9693d]",brown:"bg-[#4b271d]"};
function itemDefaults(section:CmsSection):CmsSectionItem[]{ return section.items?.length ? section.items : [{title:"",body:""}]; }

export function AdminSectionEditor({sections,onChange}:{sections:CmsSection[];onChange:(sections:CmsSection[])=>void}){
  const [collapsed,setCollapsed]=useState<Record<string,boolean>>({});
  const [dragging,setDragging]=useState<number|null>(null);
  const [dragOver,setDragOver]=useState<number|null>(null);

  function patch(index:number,patchValue:Partial<CmsSection>){onChange(sections.map((section,i)=>i===index?{...section,...patchValue}:section));}
  function move(index:number,direction:-1|1){const next=[...sections];const target=index+direction;if(target<0||target>=next.length)return;[next[index],next[target]]=[next[target],next[index]];onChange(next);}
  function reorder(from:number,to:number){if(from===to||from<0||to<0||from>=sections.length||to>=sections.length)return;const next=[...sections];const [item]=next.splice(from,1);next.splice(to,0,item);onChange(next);}
  function remove(index:number){onChange(sections.filter((_,i)=>i!==index));}
  function duplicate(index:number){const copy={...sections[index],id:globalThis.crypto?.randomUUID?.()??`${Date.now()}`,items:sections[index].items?.map(item=>({...item}))};const next=[...sections];next.splice(index+1,0,copy);onChange(next);}
  function add(type:CmsSectionType){const section=createCmsSection(type);onChange([...sections,section]);setCollapsed(current=>({...current,[section.id]:false}));}
  function updateItem(sectionIndex:number,itemIndex:number,patchItem:Partial<CmsSectionItem>){const section=sections[sectionIndex];const items=itemDefaults(section).map((item,i)=>i===itemIndex?{...item,...patchItem}:item);patch(sectionIndex,{items});}
  function addItem(sectionIndex:number){const section=sections[sectionIndex];patch(sectionIndex,{items:[...itemDefaults(section),{title:"Nouvel élément",body:""}]});}
  function removeItem(sectionIndex:number,itemIndex:number){const section=sections[sectionIndex];patch(sectionIndex,{items:itemDefaults(section).filter((_,i)=>i!==itemIndex)});}
  function toggle(id:string){setCollapsed(current=>({...current,[id]:!current[id]}));}
  function collapseAll(value:boolean){setCollapsed(Object.fromEntries(sections.map(section=>[section.id,value])));}

  return <div className="space-y-4">
    <div className="rounded-xl border border-[#5b2f22]/10 bg-[#f8eee7] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#8b4b32]">Bibliothèque de blocs</p><p className="mt-1 text-xs text-[#5b2f22]/50">Construisez la page visuellement avec des sections MOONY verrouillées par le design system.</p></div><div className="flex items-center gap-2"><button type="button" onClick={()=>collapseAll(false)} className="rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-1.5 text-[10px]">Tout déplier</button><button type="button" onClick={()=>collapseAll(true)} className="rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-1.5 text-[10px]">Tout replier</button><span className="rounded-full bg-white px-3 py-1 text-[10px] text-[#5b2f22]/55">{sections.length} bloc{sections.length>1?"s":""}</span></div></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{blockTypes.map(block=><button key={block.type} type="button" onClick={()=>add(block.type)} className="group rounded-lg border border-[#5b2f22]/9 bg-white px-3 py-3 text-left transition hover:-translate-y-[1px] hover:border-[#b86643]/45 hover:shadow-sm"><span className="flex items-center gap-2 text-xs font-semibold"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#f5e2d5] text-[#8d3b19] transition group-hover:bg-[#ead1bf]"><Plus size={12}/></span>{block.label}</span><span className="mt-1.5 block pl-8 text-[10px] leading-4 text-[#5b2f22]/45">{block.description}</span></button>)}</div>
    </div>

    {!sections.length?<div className="rounded-xl border border-dashed border-[#5b2f22]/16 bg-white/55 px-5 py-10 text-center text-sm text-[#5b2f22]/45">Cette page n’a pas encore de section additionnelle. Ajoutez un bloc depuis la bibliothèque ci-dessus.</div>:null}

    {sections.map((section,index)=>{
      const isCollapsed=Boolean(collapsed[section.id]);
      const isDragging=dragging===index;
      const isDropTarget=dragOver===index&&dragging!==null&&dragging!==index;
      return <div key={section.id} onDragOver={event=>event.preventDefault()} onDragEnter={()=>setDragOver(index)} onDrop={event=>{event.preventDefault();if(dragging!==null)reorder(dragging,index);setDragging(null);setDragOver(null)}} className={`rounded-xl border bg-white transition ${section.hidden?"border-dashed border-[#5b2f22]/12 opacity-65":"border-[#5b2f22]/10"} ${isDragging?"scale-[.995] opacity-50":""} ${isDropTarget?"ring-2 ring-[#b9693d]/35":""}`}>
        <div draggable onDragStart={event=>{setDragging(index);event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/plain",section.id)}} onDragEnd={()=>{setDragging(null);setDragOver(null)}} className="flex cursor-grab flex-wrap items-center gap-2 border-b border-[#5b2f22]/8 px-4 py-3 active:cursor-grabbing">
          <GripVertical size={15} className="text-[#5b2f22]/30"/>
          <span className={`h-5 w-5 rounded-md border border-[#5b2f22]/8 ${tonePreview[section.background??"ivory"]}`} />
          <div className="min-w-0"><strong className="block text-sm">{index+1}. {labels[section.type]}</strong>{section.title?<span className="block max-w-[360px] truncate text-[10px] text-[#5b2f22]/42">{section.title}</span>:null}</div>
          {section.hidden?<span className="rounded-full bg-zinc-100 px-2 py-1 text-[10px] text-zinc-600">Masqué</span>:null}
          <div className="ml-auto flex gap-1" onPointerDown={event=>event.stopPropagation()}>
            <button type="button" title={isCollapsed?"Déplier":"Replier"} onClick={()=>toggle(section.id)} className="rounded-md border border-[#5b2f22]/8 p-1.5">{isCollapsed?<ChevronRight size={13}/>:<ChevronDown size={13}/>}</button>
            <button type="button" title="Monter" onClick={()=>move(index,-1)} disabled={index===0} className="rounded-md border border-[#5b2f22]/8 p-1.5 disabled:opacity-25"><ArrowUp size={13}/></button>
            <button type="button" title="Descendre" onClick={()=>move(index,1)} disabled={index===sections.length-1} className="rounded-md border border-[#5b2f22]/8 p-1.5 disabled:opacity-25"><ArrowDown size={13}/></button>
            <button type="button" title={section.hidden?"Afficher":"Masquer"} onClick={()=>patch(index,{hidden:!section.hidden})} className="rounded-md border border-[#5b2f22]/8 p-1.5">{section.hidden?<Eye size={13}/>:<EyeOff size={13}/>}</button>
            <button type="button" title="Dupliquer" onClick={()=>duplicate(index)} className="rounded-md border border-[#5b2f22]/8 p-1.5"><Copy size={13}/></button>
            <button type="button" title="Supprimer" onClick={()=>remove(index)} className="rounded-md border border-red-100 p-1.5 text-red-600"><Trash2 size={13}/></button>
          </div>
        </div>

        {!isCollapsed?<div className="grid gap-4 p-4">
          {section.type!=="spacer"&&section.type!=="quote"?<label><span className="mb-1 block text-[11px] font-semibold">Surtitre</span><input value={section.eyebrow??""} onChange={e=>patch(index,{eyebrow:e.target.value})} className="w-full rounded-lg border border-[#5b2f22]/10 px-3 py-2.5 text-sm" placeholder="Facultatif"/></label>:null}
          {!["spacer","quote"].includes(section.type)?<label><span className="mb-1 block text-[11px] font-semibold">Titre</span><input value={section.title??""} onChange={e=>patch(index,{title:e.target.value})} className="w-full rounded-lg border border-[#5b2f22]/10 px-3 py-2.5 text-sm"/></label>:null}
          {["text","image_text","cta","quote","newsletter"].includes(section.type)?<label><span className="mb-1 block text-[11px] font-semibold">{section.type==="quote"?"Citation":"Texte"}</span><textarea rows={section.type==="quote"?3:4} value={section.body??""} onChange={e=>patch(index,{body:e.target.value})} className="w-full resize-none rounded-lg border border-[#5b2f22]/10 px-3 py-2.5 text-sm leading-6"/></label>:null}

          {section.type==="image_text"?<div className="grid gap-3 sm:grid-cols-2"><div className="sm:col-span-2"><span className="mb-1 block text-[11px] font-semibold">Image</span>{section.imageUrl?<div className="mb-2 overflow-hidden rounded-xl border border-[#5b2f22]/9 bg-[#f1e7df]"><img src={section.imageUrl} alt={section.imageAlt??""} className="h-48 w-full object-cover"/></div>:null}<div className="flex flex-wrap gap-2"><AdminMediaPicker value={section.imageUrl??""} onSelect={asset=>patch(index,{imageUrl:asset.url,imageAlt:section.imageAlt?.trim()?section.imageAlt:asset.altText})}/>{section.imageUrl?<button type="button" onClick={()=>patch(index,{imageUrl:"",imageAlt:""})} className="rounded-lg border border-red-100 px-3 py-2.5 text-xs text-red-600">Retirer l’image</button>:null}</div></div><label><span className="mb-1 block text-[11px] font-semibold">Image URL</span><input value={section.imageUrl??""} onChange={e=>patch(index,{imageUrl:e.target.value})} className="w-full rounded-lg border border-[#5b2f22]/10 px-3 py-2.5 text-sm" placeholder="/images/... ou https://…"/></label><label><span className="mb-1 block text-[11px] font-semibold">Texte alternatif</span><input value={section.imageAlt??""} onChange={e=>patch(index,{imageAlt:e.target.value})} className="w-full rounded-lg border border-[#5b2f22]/10 px-3 py-2.5 text-sm" placeholder="Décrivez l’image pour l’accessibilité"/></label><label><span className="mb-1 block text-[11px] font-semibold">Position</span><select value={section.imageSide??"right"} onChange={e=>patch(index,{imageSide:e.target.value as "left"|"right"})} className="w-full rounded-lg border border-[#5b2f22]/10 px-3 py-2.5 text-sm"><option value="right">Image à droite</option><option value="left">Image à gauche</option></select></label></div>:null}

          {["image_text","cta"].includes(section.type)?<div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-1 block text-[11px] font-semibold">Texte du bouton</span><input value={section.ctaLabel??""} onChange={e=>patch(index,{ctaLabel:e.target.value})} className="w-full rounded-lg border border-[#5b2f22]/10 px-3 py-2.5 text-sm"/></label><label><span className="mb-1 block text-[11px] font-semibold">Lien</span><input value={section.ctaHref??""} onChange={e=>patch(index,{ctaHref:e.target.value})} className="w-full rounded-lg border border-[#5b2f22]/10 px-3 py-2.5 text-sm"/></label></div>:null}

          {!["spacer","testimonials","partners"].includes(section.type)?<label className="max-w-xs"><span className="mb-1 block text-[11px] font-semibold">Ambiance du fond</span><select value={section.background??"ivory"} onChange={e=>patch(index,{background:e.target.value as CmsSection["background"]})} className="w-full rounded-lg border border-[#5b2f22]/10 px-3 py-2.5 text-sm"><option value="ivory">Ivoire</option><option value="peach">Pêche</option><option value="terracotta">Terracotta</option><option value="brown">Brun profond</option></select></label>:null}

          {["cards","stats","faq"].includes(section.type)?<div><div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-semibold">Éléments</span><button type="button" onClick={()=>addItem(index)} className="rounded-md border border-[#5b2f22]/10 px-2 py-1 text-[10px]">+ Ajouter</button></div><div className="space-y-2">{itemDefaults(section).map((item,itemIndex)=><div key={`${section.id}-${itemIndex}`} className="grid gap-2 rounded-lg bg-[#fffaf6] p-3 sm:grid-cols-[1fr_1.5fr_auto]">{section.type==="stats"?<input value={item.value??""} onChange={e=>updateItem(index,itemIndex,{value:e.target.value})} placeholder="Valeur (ex. 12 pays)" className="rounded-md border border-[#5b2f22]/9 px-2 py-2 text-xs"/>:<input value={item.title??""} onChange={e=>updateItem(index,itemIndex,{title:e.target.value})} placeholder={section.type==="faq"?"Question":"Titre"} className="rounded-md border border-[#5b2f22]/9 px-2 py-2 text-xs"/>}<input value={(section.type==="stats"?item.label:item.body)??""} onChange={e=>updateItem(index,itemIndex,section.type==="stats"?{label:e.target.value}:{body:e.target.value})} placeholder={section.type==="stats"?"Libellé":"Texte"} className="rounded-md border border-[#5b2f22]/9 px-2 py-2 text-xs"/><button type="button" onClick={()=>removeItem(index,itemIndex)} className="rounded-md border border-red-100 p-2 text-red-500"><Trash2 size={12}/></button></div>)}</div></div>:null}
        </div>:<button type="button" onClick={()=>toggle(section.id)} className="flex w-full items-center justify-between px-4 py-3 text-left text-xs text-[#5b2f22]/48"><span>Bloc replié — {section.title||labels[section.type]}</span><span>Déplier</span></button>}
      </div>
    })}

    {sections.length>1?<div className="rounded-xl border border-dashed border-[#5b2f22]/12 bg-[#fffaf4] px-4 py-3 text-center text-[10px] leading-4 text-[#5b2f22]/45">Astuce : attrapez l’en-tête d’un bloc et faites-le glisser pour changer sa position. Les boutons ↑ ↓ restent disponibles pour une réorganisation précise.</div>:null}
  </div>;
}
