from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import Image, PageBreak, KeepTogether
import os, glob
FOTOS=os.path.join(os.path.dirname(os.path.abspath(__file__)),'fotos')

def m(x): return "$" + f"{x:,.0f}".replace(",", ".")
def M(x): return ("-" if x<0 else "") + "$" + f"{abs(x)/1e6:,.1f}".replace(".", ",") + "M"

VENTA=18_500_000; CARG=1_000_000; KM=1800; DIESEL=200_000; MANT=30_000; INY=70; PERD=1.10
models=[("EX30 Core",29_900_000,17.0,"~340"),("EX30 Plus",36_900_000,17.0,"~470"),
("EX40 P6",43_900_000,20.0,"~460"),("EC40 P6",46_900_000,19.5,"~470"),
("EX30 Cross Country",49_900_000,18.5,"~427"),("EX90",99_900_000,25.0,"~580")]
rows=[]
for n,p,c,a in models:
    inv=p-VENTA+CARG
    kwh=c*KM/100*PERD
    costo_iny=kwh*INY
    ah0=DIESEL+MANT
    ah1=DIESEL+MANT-costo_iny
    rows.append([n,M(p),M(inv),f"{c:.1f}".replace(".",","),a,f"{kwh:.0f}",m(costo_iny),m(ah0),m(ah1),
      f"{inv/ah0/12:.1f}".replace(".",","),f"{inv/ah1/12:.1f}".replace(".",","),M(ah0*120-inv)])
    print(rows[-1])

ss=getSampleStyleSheet()
h=ParagraphStyle('h',parent=ss['Title'],fontSize=18,textColor=colors.HexColor("#1F3A5F"))
sub=ParagraphStyle('s',parent=ss['Normal'],fontSize=10,textColor=colors.HexColor("#555555"))
h2=ParagraphStyle('h2',parent=ss['Heading2'],fontSize=12,textColor=colors.HexColor("#1F3A5F"),spaceBefore=10)
n=ParagraphStyle('n',parent=ss['Normal'],fontSize=8.8,leading=11.5)
cell=ParagraphStyle('c',parent=ss['Normal'],fontSize=7.8,leading=9.5,alignment=1,textColor=colors.white,fontName="Helvetica-Bold")

doc=SimpleDocTemplate("Estudio_XC60_vs_Volvo_Electricos.pdf",pagesize=landscape(A4),
  leftMargin=1.3*cm,rightMargin=1.3*cm,topMargin=1.2*cm,bottomMargin=1.2*cm,
  title="Estudio XC60 diésel vs Volvo eléctricos")
s=[]
s.append(Paragraph("Volvo XC60 2018 diésel vs. Volvo eléctricos",h))
s.append(Paragraph("Estudio de retorno de inversión — parcela en Paine con 32 paneles solares y baterías · Octubre 2026",sub))
s.append(Spacer(1,8))

s.append(Paragraph("Situación actual",h2))
base=[["Vehículo","Gasto diésel/mes","Litros/mes","Km/mes (aprox.)","Mantención/mes","Valor de venta estimado"],
 ["Volvo XC60 2018 D4 diésel",m(DIESEL),"~132 L ($1.513/L)",f"~{KM:,}".replace(",","."),"~$45.000","$18,5M"]]
t=Table(base,colWidths=[5.5*cm,3.6*cm,3.8*cm,3.4*cm,3.4*cm,4.4*cm])
t.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),colors.HexColor("#1F3A5F")),("TEXTCOLOR",(0,0),(-1,0),colors.white),
 ("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"),("FONTSIZE",(0,0),(-1,-1),8.5),("ALIGN",(1,0),(-1,-1),"CENTER"),
 ("GRID",(0,0),(-1,-1),0.4,colors.HexColor("#BBBBBB")),("BACKGROUND",(0,1),(-1,1),colors.HexColor("#F3F5F8"))]))
s.append(t)

s.append(Paragraph("Cuadro comparativo",h2))
hdr=["Modelo","Precio*","Inversión neta**","Consumo kWh/100 km","Autonomía km (aprox.)","kWh/mes","Costo carga/mes***",
 "Ahorro/mes (carga solar)","Ahorro/mes (si inyecta)","Retorno años (solar)","Retorno años (si inyecta)","Ganancia neta a 10 años"]
data=[[Paragraph(x,cell) for x in hdr]]+rows
cw=[3.3,1.9,2.2,1.9,2.0,1.5,2.1,2.3,2.3,1.9,1.9,2.1]
t=Table(data,colWidths=[x*cm for x in cw],repeatRows=1)
st=[("BACKGROUND",(0,0),(-1,0),colors.HexColor("#1F3A5F")),("FONTSIZE",(0,1),(-1,-1),8.5),
 ("ALIGN",(1,1),(-1,-1),"CENTER"),("VALIGN",(0,0),(-1,-1),"MIDDLE"),("FONTNAME",(0,1),(0,-1),"Helvetica-Bold"),
 ("GRID",(0,0),(-1,-1),0.4,colors.HexColor("#BBBBBB")),
 ("BACKGROUND",(0,1),(-1,1),colors.HexColor("#DFF0D8")),("BACKGROUND",(0,6),(-1,6),colors.HexColor("#F8E0E0")),
 ("FONTNAME",(9,1),(10,-1),"Helvetica-Bold"),("TOPPADDING",(0,0),(-1,-1),4),("BOTTOMPADDING",(0,0),(-1,-1),4)]
for i in range(2,6): st.append(("BACKGROUND",(0,i),(-1,i),colors.white if i%2 else colors.HexColor("#F3F5F8")))
t.setStyle(TableStyle(st)); s.append(t)
s.append(Spacer(1,4))
s.append(Paragraph("* Precios \"desde\" en Chile con bono de marca y de financiamiento (pagando contado suben ~$4–6M). "
 "** Precio − venta del XC60 ($18,5M) + cargador domiciliario e instalación ($1M). "
 "*** Valor de la energía si en vez de cargar el auto la inyectara a la red (~$70/kWh); si el excedente hoy se pierde, la carga es gratis.",n))

s.append(Paragraph("Conclusiones",h2))
for x in ["<b>EX30 Core</b> es la opción más rentable: se paga en ~4,5 años y deja más de $15M de ganancia neta a 10 años.",
 "<b>EX40 y EC40</b> (tamaño más parecido al XC60) se pagan en ~10 años: razonable si de todas formas quiere renovar el auto.",
 "<b>EX30 Plus</b> es el punto medio: más autonomía (~470 km) y retorno de ~7 años.",
 "<b>EX90</b> no se justifica por ahorro: es una compra de gusto, no una inversión.",
 "Con 32 paneles y baterías, la energía para el auto (~350–440 kWh/mes) es una fracción de lo que produce la parcela."]:
    s.append(Paragraph("• "+x,n))

s.append(Paragraph("Supuestos y recomendaciones",h2))
for x in ["Diésel a ~$1.513/L (promedio nacional tras el alza de $95 del 1 de octubre de 2026). Si sigue subiendo, el retorno se acorta.",
 "Recorrido ~1.800 km/mes (calculado desde $200.000 de diésel a 13–14 km/L reales). Consumos eléctricos reales aproximados, con 10% de pérdidas de carga.",
 "Mantención del eléctrico ~$30.000/mes más barata que el diésel (sin aceite, filtros, distribución ni turbo).",
 "No incluye intereses del crédito (necesario para acceder al bono de financiamiento), seguro ni permiso de circulación.",
 "Cargar de día directo del sol cuando el auto esté en la parcela; de noche usaría ~12–15 kWh diarios de las baterías de la casa: revisar su capacidad.",
 "EX30: en 2026 hubo un llamado a revisión por la batería (límite de carga al 70% en algunas unidades). Consultar en el concesionario.",
 "Fuentes: volvohomestore.cl, portillosur.cl, chileautos.cl, preciocombustible.cl, ENAP. Valores referenciales; confirmar precios al cotizar."]:
    s.append(Paragraph("• "+x,n))

slugs={"EX30 Core":"ex30","EX30 Plus":"ex30","EX40 P6":"ex40","EC40 P6":"ec40","EX30 Cross Country":"ex30cc","EX90":"ex90"}
def foto(slug,tipo,w,h):
    for ext in ("jpg","jpeg","png","webp"):
        p=os.path.join(FOTOS,f"{slug}_{tipo}.{ext}")
        if os.path.exists(p):
            if ext=="webp":
                from PIL import Image as PI
                q=p[:-4]+"jpg"; PI.open(p).convert("RGB").save(q); p=q
            from PIL import Image as PI
            iw,ih=PI.open(p).size; r=min(w/iw,h/ih)
            return Image(p,width=iw*r,height=ih*r)
    t=Table([[f"Falta foto: fotos/{slug}_{tipo}.jpg"]],colWidths=[w],rowHeights=[h])
    t.setStyle(TableStyle([("BOX",(0,0),(-1,-1),0.5,colors.grey),("ALIGN",(0,0),(-1,-1),"CENTER"),("VALIGN",(0,0),(-1,-1),"MIDDLE"),("TEXTCOLOR",(0,0),(-1,-1),colors.grey)]))
    return t
vistos=set()
for (nm,p,c,a),r in zip(models,rows):
    sl=slugs[nm]
    s.append(PageBreak())
    s.append(Paragraph(f"Volvo {nm}",h))
    s.append(Paragraph(f"Precio {r[1]} · Inversión neta {r[2]} · Autonomía {a} km · Consumo {r[3]} kWh/100 km · Retorno {r[9]} años (solar) / {r[10]} años (si inyecta) · Ganancia a 10 años {r[11]}",sub))
    s.append(Spacer(1,10))
    W,H=12.8*cm,8.6*cm
    t=Table([[Paragraph("<b>Exterior</b>",n),Paragraph("<b>Interior</b>",n)],[foto(sl,"ext",W,H),foto(sl,"int",W,H)]],colWidths=[13.4*cm,13.4*cm])
    t.setStyle(TableStyle([("ALIGN",(0,0),(-1,-1),"CENTER"),("VALIGN",(0,0),(-1,-1),"MIDDLE")]))
    s.append(t)
    s.append(Spacer(1,6))
    s.append(Paragraph("Imágenes referenciales del fabricante.",sub))
doc.build(s)
