import statistics as st
EXCEL = [
 ("Cobb","Multistage",34,0.7729,1),("Cobb","Multistage",35,0.8557,2),("Cobb","Multistage",37,0.8264,2),
 ("Cobb","Multistage",38,0.8149,3),("Cobb","Multistage",39,0.8081,1),("Cobb","Multistage",40,0.7913,3),
 ("Cobb","Multistage",41,0.8537,2),("Cobb","Multistage",43,0.8449,3),("Cobb","Multistage",46,0.7921,3),
 ("Cobb","Multistage",48,0.7821,2),("Cobb","Multistage",49,0.786,2),("Cobb","Multistage",50,0.7622,2),
 ("Cobb","Multistage",51,0.765,1),("Cobb","Multistage",52,0.7893,10),("Cobb","Multistage",53,0.7854,1),
 ("Cobb","Multistage",56,0.5854,1),("Cobb","Multistage",57,0.7478,14),("Cobb","Multistage",58,0.7568,20),
 ("Cobb","Multistage",59,0.7286,20),("Cobb","Multistage",60,0.7006,10),("Cobb","Multistage",61,0.6849,10),
 ("Cobb","Multistage",62,0.6377,12),("Cobb","Multistage",63,0.6223,1),
 ("Ross","Multistage",28,0.9115,1),("Ross","Multistage",29,0.8897,9),("Ross","Multistage",30,0.9073,19),
 ("Ross","Multistage",31,0.8869,21),("Ross","Multistage",32,0.8786,20),("Ross","Multistage",33,0.8313,10),
 ("Ross","Multistage",34,0.8515,15),("Ross","Multistage",35,0.8782,6),("Ross","Multistage",36,0.8563,8),
 ("Ross","Multistage",37,0.8686,18),("Ross","Multistage",38,0.8886,2),("Ross","Multistage",39,0.8666,8),
 ("Ross","Multistage",40,0.8177,2),("Ross","Multistage",41,0.8232,3),("Ross","Multistage",42,0.8567,2),
 ("Ross","Multistage",43,0.8731,1),("Ross","Multistage",44,0.8404,55),("Ross","Multistage",45,0.8576,68),
 ("Ross","Multistage",46,0.8368,59),("Ross","Multistage",47,0.8232,49),("Ross","Multistage",48,0.8345,47),
 ("Ross","Multistage",49,0.8387,71),("Ross","Multistage",50,0.8138,65),("Ross","Multistage",51,0.8529,82),
 ("Ross","Multistage",52,0.8288,38),("Ross","Multistage",53,0.8389,66),("Ross","Multistage",54,0.8373,99),
 ("Ross","Multistage",55,0.8109,114),("Ross","Multistage",56,0.8173,144),("Ross","Multistage",57,0.7997,97),
 ("Ross","Multistage",58,0.7928,93),("Ross","Multistage",59,0.7916,101),("Ross","Multistage",60,0.778,72),
 ("Ross","Multistage",61,0.7958,48),("Ross","Multistage",62,0.8317,24),("Ross","Multistage",63,0.6894,4),
 ("Ross","Multistage",64,0.7723,7),
 ("Ross","Singlestage",45,0.8796,9),("Ross","Singlestage",46,0.9087,33),("Ross","Singlestage",47,0.9072,38),
 ("Ross","Singlestage",48,0.8705,40),("Ross","Singlestage",49,0.9091,8),("Ross","Singlestage",50,0.902,9),
 ("Ross","Singlestage",51,0.8684,8),("Ross","Singlestage",52,0.855,24),("Ross","Singlestage",53,0.8679,16),
 ("Ross","Singlestage",54,0.8679,3),("Ross","Singlestage",55,0.8267,13),
]
REAL = [
 (9,"Ross","Multistage",50,0.8317,2),(3,"Cobb","Multistage",56,0.7479,7),(9,"Ross","Singlestage",50,0.8783,13),
 (9,"Ross","Multistage",49,0.8457,30),(2,"Ross","Singlestage",59,0.8062,8),(14,"Cobb","Multistage",39,0.9069,5),
 (25,"Cobb","Multistage",28,0.8577,5),(9,"Ross","Multistage",48,0.8591,13),(3,"Cobb","Multistage",55,0.7586,5),
 (25,"Cobb","Multistage",27,0.8456,11),(9,"Ross","Singlestage",49,0.8844,20),(3,"Cobb","Multistage",54,0.7682,11),
 (10,"Ross","Singlestage",48,0.8649,6),(9,"Ross","Singlestage",51,0.8835,3),(2,"Ross","Multistage",58,0.7715,32),
 (4,"Ross","Multistage",54,0.774,1),(2,"Ross","Singlestage",58,0.8224,6),(2,"Ross","Multistage",57,0.7682,27),
 (2,"Ross","Multistage",59,0.776,14),(25,"Cobb","Multistage",26,0.8138,8),(2,"Ross","Multistage",60,0.7217,2),
 (9,"Ross","Singlestage",48,0.8932,8),(2,"Ross","Singlestage",57,0.8273,8),
]
def excel_points(e,m): return [(s,v,n) for (ee,mm,s,v,n) in EXCEL if ee==e and mm==m]
def smooth_shape(e,m,setm,win=2):
    pts=excel_points(e,m)
    if not pts: return None
    num=den=0.0
    for s,v,n in pts:
        if abs(s-setm)<=win: num+=n*v; den+=n
    if den>0: return num/den
    smin=min(p[0] for p in pts); smax=max(p[0] for p in pts)
    return smooth_shape(e,m,smin if setm<smin else smax,win)
def ss_bonus():
    d=[]
    for s in range(45,56):
        ms=smooth_shape("Ross","Multistage",s); ss=smooth_shape("Ross","Singlestage",s)
        if ms and ss: d.append(ss-ms)
    return sum(d)/len(d)
BONUS=ss_bonus()
def shape(e,m,setm):
    base=smooth_shape(e,"Multistage",setm)
    if base is None: base=smooth_shape("Ross","Multistage",setm)
    if m=="Singlestage": base+=BONUS
    return base
def level_offset(rows):
    num=den=0.0
    for lot,e,m,s,v,n in rows:
        num+=n*(v-shape(e,m,s)); den+=n
    return num/den if den else 0.0
def predict(e,m,setm,off): return max(0.0,min(1.0,shape(e,m,setm)+off))
lots=sorted(set(r[0] for r in REAL))
print(f"Bonus SS (Excel 45-55): +{BONUS*100:.2f} pp")
print(f"Offset nivell (tots els reals): {level_offset(REAL)*100:+.2f} pp\n")
print("LOO per lot (nivell de lot, ponderat per n):")
print(f"{'lot':>4} {'estirp':>5} {'maq':>11} {'setm':>7} {'real%':>7} {'pred%':>7} {'err':>6} {'ncar':>5}")
abs_errs=[]; lot_rows=[]
for L in lots:
    held=[r for r in REAL if r[0]==L]; others=[r for r in REAL if r[0]!=L]
    off=level_offset(others); rn=sum(r[5] for r in held)
    real_lot=sum(r[4]*r[5] for r in held)/rn
    pred_lot=sum(predict(r[1],r[2],r[3],off)*r[5] for r in held)/rn
    smin=min(r[3] for r in held); smax=max(r[3] for r in held)
    lbl=f"{smin}-{smax}" if smin!=smax else f"{smin}"
    maqs="/".join(sorted(set(r[2] for r in held)))
    err=(pred_lot-real_lot)*100; abs_errs.append(abs(err)); lot_rows.append((L,real_lot,pred_lot,rn))
    print(f"{L:>4} {held[0][1]:>5} {maqs:>11} {lbl:>7} {real_lot*100:>6.1f} {pred_lot*100:>6.1f} {err:>+6.1f} {rn:>5}")
print(f"\nMAE LOO nivell lot: {sum(abs_errs)/len(abs_errs):.2f} pp")
be=[abs((0.82-rl)*100) for (_,rl,_,_) in lot_rows]
print(f"MAE baseline 0.82: {sum(be)/len(be):.2f} pp")
print("\nCalibratge marge (LOO, nivell lot):")
print(f"{'marge':>6} {'curts':>6} {'excedent_mig_pp':>16}")
for mpp in [0,1,2,3,4,5]:
    m=mpp/100; curts=0; exc=[]
    for L in lots:
        held=[r for r in REAL if r[0]==L]; others=[r for r in REAL if r[0]!=L]
        off=level_offset(others); rn=sum(r[5] for r in held)
        rl=sum(r[4]*r[5] for r in held)/rn
        pl=sum(predict(r[1],r[2],r[3],off)*r[5] for r in held)/rn - m
        if pl>rl: curts+=1
        else: exc.append((rl-pl)*100)
    print(f"{mpp:>6} {curts:>6} {(sum(exc)/len(exc) if exc else 0):>16.2f}")
