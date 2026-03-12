/*[materijali]*/
m=16;m1=18;mdf=18;hdf=3;rpl=38; 
/*[prikaz(ukljuci/iskljuci)]*/
front_vrata=true;
polica=true;
pozadina=true;
celafioka=true;
fioke=true;
radna_ploca=true;

/*[dezeni]*/
dezen_front="red";//[blue,black,white,Silver,Moccasin,Azure]
dezen_front1="red";//[blue,black,white,Silver]
dezen_radne_ploce="white";//[white green,red]
dezen_kutije="white";//[white green,red,DimGray]
dezen_granc="black";//[blue,black,white,BurlyWood,chocolate]
/*[parametri prostora]*/
visina_zida=2630;
desni_zid=3440;ceoni_zid=2220;lijevi_zid=2730;
/*[parametri kuhinje]*/
se=900;c=100;


include<C:\Users\mersu\Downloads\konfigurator\kuhinjski_aparati.scad>;

module radni_stol_pored_stuba(s,v,d,c,brp,brv,ss,ds,vs){
module stub(ss,ds,vs){
cube([ss,ds,vs]);
}
translate([s-ss,-ds+hdf,0])
*stub(200,170,2500);
module kutija(){

 stranica=[m1,d,v-c];echo(str("Stranica m1 :",(v-c)/10,"x",d/10,"x 1kom.(1d i 2k)")); 
 stranica_do_stuba=[m1,d-ds,v-c];echo(str("stranica do stuba mdf:",(v-c)/10,"x",(d-ds)/10,"x 1kom. ((1d i 2k))")); 
 stranica_do_stuba_bocna=[m1,ds,v-c-2*m1];echo(str("stranica do stuba bocna m1:",(v-c-2*m1)/10,"x",ds/10,"x 1kom. ((1d i 2k))")); 
 prednja_stranica_do_stuba=[ss,m1,v-c-2*m1];echo(str("prednja stranica do stuba m1:",(v-c-2*m1)/10,"x",ss/10,"x 1kom. (1d i 2k)"));    
 dno=[s-2*m1,d,m1];echo(str("dno m1:",(s-2*m1)/10,"x",d/10,"x 1kom. (1d sece se za stub cose)"));    
 traverzna=[s-2*m1,70,m1];echo(str("traverzna m1:",(s-2*m1)/10,"x",70/10,"x 1kom. (2d) "));    
 traverzna_do_stuba=[s-m1-ss,70,m1];echo(str("traverzna do stuba m1:",(s-m1-ss)/10,"x",70/10,"x 1kom. (2d) ")); 
 lesonit=[s-ss,hdf,v-c];echo(str("lesonit hdf:",(s-ss)/10,"x",(v-c)/10,"x 1kom."));        
 stub=[ss,ds,vs];
 color(dezen_kutije){ 
 translate([0,-d,c])cube(stranica);   
 translate([s-m1,-d,c]) cube(stranica_do_stuba); 
 translate([s-m1-ss,-ds,c+m1])cube(stranica_do_stuba_bocna);
 translate([s-m1-ss,-ds-m1,c+m1])cube(prednja_stranica_do_stuba);    
difference(){
 translate([m1,-d,c]) cube(dno);
 translate([s-ss,-ds+1,0]) cube(stub);}    
 translate([m1,-70,v-m1]) cube(traverzna_do_stuba);
 translate([m1,-d,v-m1]) cube(traverzna);
if(pozadina){    
 translate([0,0,c]) cube(lesonit);
} } }

kutija();   
module police(brp){   
police=[s-2*m1,d-50,m1];echo(str("police m1:",(s-2*m1)/10,"x",(d-50)/10,"x",brp,"kom. (1d sece se za stub cose)"));
stub=[ss+m1,ds+m1,vs];    
if(polica) { 
  color(dezen_kutije){   
rasporedi_police=(v-c-m1)/(brp+1);
for(i=[1:brp]){
 difference(){   
translate([m1,-d+50,c+i*rasporedi_police]) cube(police);
translate([s-ss-m1,-ds-m1+1,0]) cube(stub);
}}
}} }   
police(1);

module vrata(brv){
 vrata=[s/brv-3,mdf,v-c-3];echo(str("vrata mdf:",(v-c-3)/10,"x",(s/brv-3)/10,"x",brv,"kom.(2D i 2K)"));
if(front_vrata){ 
color(dezen_front){   
rasporedi_vrata=s/brv;
for(i=[0:(brv-1)])
translate([1.5+i*rasporedi_vrata,-d-mdf,c])cube(vrata);}
    postavi_rucke=50*brv;
for(j=[0:(brv-1)])
translate([s/brv-50+j*postavi_rucke,-d-mdf,v-186/2-50])cevasta_rucka(186,25,8); 
    }
}
vrata(brv);
}
*radni_stol_pored_stuba(700,820,550,c,1,2,200,170,2500);
module radni_stol_pored_stuba_gola(s,v,d,c,brp,brv,ss,ds,vs){
module stub(ss,ds,vs){
cube([ss,ds,vs]);
}
translate([s-ss,0-ds+hdf,0])
*stub(200,170,2500);
module kutija(){
  /*materijali*/
    
 stranica=[m1,d,v-c];echo(str("Stranica m1:",(v-c)/10,"x",d/10,"x 1kom.(1d i 2k)")); 
 stranica_do_stuba=[m1,d-ds,v-c];echo(str("stranica do stuba mdf:",(v-c)/10,"x",(d-ds)/10,"x 1kom. (1d i 2k)")); 
 stranica_do_stuba_bocna=[m1,ds,v-c-2*m1];echo(str("stranica do stuba bocna m1:",(v-c-2*m1)/10,"x",ds/10,"x 1kom. (1d i 2k)")); 
 prednja_stranica_do_stuba=[ss,m1,v-c-2*m1];echo(str("prednja stranica do stuba mdf:",(v-c-2*m1)/10,"x",ss/10,"x 1kom. (1d i 2k)"));    
 dno=[s-2*m1,d,m1];echo(str("dno m1:",(s-2*m1)/10,"x",d/10,"x 1kom. (1d sece se za stub cose)"));    
 traverzna=[s-2*m1,70,m1];echo(str("traverzna m1:",(s-2*m1)/10,"x",70/10,"x 1kom. (2d) "));    
 traverzna_do_stuba=[s-m1-ss,70,m1];echo(str("traverzna do stuba m1:",(s-m1-ss)/10,"x",70/10,"x 1kom. (2d) ")); 
 lesonit=[s-ss,hdf,v-c];echo(str("lesonit hdf:",(s-ss)/10,"x",(v-c)/10,"x 1kom."));        
 stub=[ss,ds,vs];
 color(dezen_kutije){ 
 translate([0,-d,c])cube(stranica);   
 translate([s-m1,-d,c]) cube(stranica_do_stuba); 
 translate([s-m1-ss,-ds,c+m1])cube(stranica_do_stuba_bocna);
 translate([s-m1-ss,-ds-m1,c+m1])cube(prednja_stranica_do_stuba);    
difference(){
 translate([m1,-d,c]) cube(dno);
 translate([s-ss,-ds+1,0]) cube(stub);}    
 translate([m1,-70,v-m1]) cube(traverzna_do_stuba);
 translate([m1,-d,v-60]) cube(traverzna);
if(pozadina){    
 translate([0,0,c]) cube(lesonit);
} } }

kutija();    
module police(brp){   
police=[s-2*m1,d-50,m1];echo(str("police m1:",(s-2*m1)/10,"x",(d-50)/10,"x",brp,"kom. (1d sece se za stub cose)"));
stub=[ss+m1,ds+m1,vs];    
if(polica) { 
  color(dezen_kutije) { 
rasporedi_police=(v-c-m1)/(brp+1);
for(i=[1:brp]){
 difference(){   
translate([m1,-d+50,c+i*rasporedi_police]) cube(police);
translate([s-ss-m1,-ds-m1+1,0]) cube(stub);
}}
}} }   
police(1);

module vrata(brv){
 vrata=[s/brv-3,mdf,v-c-33];echo(str("vrata mdf:",(v-c-33)/10,"x",(s/brv-3)/10,"x",brv,"kom.(2D i 2K)"));
if(front_vrata){    
rasporedi_vrata=s/brv;
for(i=[0:(brv-1)])
 color(dezen_front) translate([1.5+i*rasporedi_vrata,-d-mdf,c])cube(vrata);    
  }  
}
vrata(brv);
}
*radni_stol_pored_stuba_gola(700,880,550,c,1,2,200,170,2500);
module fiokar(s,v,d,c,brf,brfp,brfd){    
module kutija(){
    
 stranice=[m1,d,v-c];echo(str("stranice m1:",(v-c)/10,"x",d/10,"x 2kom. (1d i 2k)")); 
 dno=[s-2*m1,d,m1];echo(str("dno m1:",(s-2*m1)/10,"x",d/10,"x 1kom. (1d) "));    
 traverzne=[s-2*m1,70,m1];echo(str("traverzne m1:",(s-2*m1)/10,"x",70/10,"x 1kom. (2d) "));    
 lesonit=[s,hdf,v-c];echo(str("lesonit hdf:",s/10,"x",(v-c)/10,"x 1kom."));        
   color(dezen_kutije){    
 translate([0,-d,c])cube(stranice);   
 translate([s-m1,-d,c]) cube(stranice);     
 translate([m1,-d,c]) cube(dno);     
 translate([m1,-70,v-m1]) cube(traverzne);
 translate([m1,-d,v-m1]) cube(traverzne);
if(pozadina){    
 translate([0,0,c]) cube(lesonit);
}  } }

kutija(); 
module fioke_duboke(brf,brfd,kl){
//celo_duboke_fioke
if(celafioka){

 celo_duboke_fioke= [s-3,mdf,(v-c)/brf*2-3];
    echo(str("celo_duboke_fioke mdf:",((v-c)/brf*2-3)/10,"x",(s-3)/10,"x",brfd,"kom.(2D i 2K)"));  
pom=(v-c)/brf ;
  for(j=[0]){
color(dezen_front){      
translate([1.5,-d-mdf,c+j*pom])
cube(celo_duboke_fioke);}  
translate([s/2,-d-mdf,c+((v-c)/brf)+j*pom])cevasta_rucka_horizontala(186,25,8);}   
}
//fioka_duboka
stranica_duboke_fioke=[m,kl-8,(v-c)/brf*2-58];
    echo(str("stranica_duboke_fioke m:",((v-c)/brf*2-58)/10,"x",(kl-10)/10,"x",brfd*2,"kom.(2d i 2k)"));
mstr_duboke_fioke=[s-2*m1-8-2*m,m1,(v-c)/brf*2-58-12-m1];
    echo(str("p/z_str_duboke_fioke m1:",((v-c)/brf*2-58-12-m1)/10,"x",(s-2*m1-8-2*m)/10,"x",brfd*2,"kom.(1d)"));
dno_fioka=[s-2*m1-8-2*m,kl-10,m1];
    echo(str("dno_fioke m1:",(kl-10)/10,"x",(s-2*m1-8-2*m)/10,"x",brfd,"kom.(2d)"));
 if(fioke){
 pom=(v-c)/brf ;
  for(i=[0]){
 translate([0,-d,c+12+i*pom])union(){   
color(dezen_kutije) {
 translate([m1+4,0,m1+4])
cube(stranica_duboke_fioke);
translate([s-m1-4-m,0,m1+4])
cube(stranica_duboke_fioke);
translate([m1+4+m,0,m1+4+12+m1])
cube(mstr_duboke_fioke);
translate([m1+4+m,kl-10-m1,m1+4+12+m1])
cube(mstr_duboke_fioke);
translate([m1+4+m,0,m1+4+12])
color([0,1,0])
cube(dno_fioka);
        }      }
}
 }      
}
fioke_duboke(4,1,500);
module fioke_plitke(brf,brfp,kl){
//cela_plitkih_fioka
if(celafioka){

 celo_plitke_fioke= [s-3,mdf,(v-c)/brf-3];
    echo(str("celo_plitke_fioke mdf:",((v-c)/brf-3)/10,"x",(s-3)/10,"x",brfp,"kom.(2D i 2K)"));  
pomeriti=(v-c)/brf ;
  for(k=[2:brf-1]){
color(dezen_front){      
translate([1.5,-d-mdf,c+k*pomeriti])
cube(celo_plitke_fioke); }
translate([s/2,-d-mdf,c+(v-c)/brf-50+k*pomeriti])cevasta_rucka_horizontala(186,25,8);}
}
//fioka_plitka
stranica_plitke_fioke=[m,kl-8,(v-c)/brf-58];
    echo(str("stranica_plitke_fioke m:",((v-c)/brf-58)/10,"x",(kl-10)/10,"x",brfp*2,"kom.(2d i 2k)"));
mstr_plitke_fioke=[s-2*m1-8-2*m,m1,(v-c)/brf-58-12-m1];
    echo(str("p/z_str_plitke_fioke m1:",((v-c)/brf-58-12-m1)/10,"x",(s-2*m1-8-2*m)/10,"x",brfp*2,"kom.(1d)"));
dno_fioka=[s-2*m1-8-2*m,kl-10,m1];
    echo(str("dno_fioke m1:",(kl-10)/10,"x",(s-2*m1-8-2*m)/10,"x",brfp*2,"kom.(2d)"));
 if(fioke){
 pom=(v-c)/brf ;
  for(i=[2:(brf-1)]){
translate([0,-d,c+12+i*pom])union(){   
color(dezen_kutije){ 
translate([m1+4,0,m1+4])
cube(stranica_plitke_fioke);
translate([s-m1-4-m,0,m1+4])
cube(stranica_plitke_fioke);
translate([m1+4+m,0,m1+4+12+m1])
cube(mstr_plitke_fioke);
translate([m1+4+m,kl-10-m1,m1+4+12+m1])
cube(mstr_plitke_fioke);
translate([m1+4+m,0,m1+4+12])
color([0,1,0])
cube(dno_fioka);
              }
}}
 }      
}
fioke_plitke(4,2,500);
}
*fiokar(600,820,550,c,3,2,1);
module fiokar_gola(s,v,d,c,brf,brfp,brfd){    
module kutija(){
    
 stranice=[m1,d,v-c];echo(str("stranice m1:",(v-c)/10,"x",d/10,"x 2kom. (1d i 2k)")); 
 dno=[s-2*m1,d,m1];echo(str("dno m1:",(s-2*m1)/10,"x",d/10,"x 1kom. (1d) "));    
 traverzne=[s-2*m1,70,m1];echo(str("traverzne m1:",(s-2*m1)/10,"x",70/10,"x 1kom. (2d) "));    
 lesonit=[s,hdf,v-c];echo(str("lesonit hdf:",s/10,"x",(v-c)/10,"x 1kom."));        
   color(dezen_kutije){    
 translate([0,-d,c])cube(stranice);   
 translate([s-m1,-d,c]) cube(stranice);     
 translate([m1,-d,c]) cube(dno);     
 translate([m1,-70,v-m1]) cube(traverzne);
 translate([m1,-d,v-m1-50]) cube(traverzne);
if(pozadina){    
 translate([0,0,c]) cube(lesonit);
}  } }

kutija(); 
module fioke_duboke(brf,brfd,kl){
//celo_duboke_fioke
if(celafioka){
color(dezen_front){
 celo_duboke_fioke= [s-3,mdf,(v-c)/brf*2-30];
    echo(str("celo_duboke_fioke  mdf:",((v-c)/brf*2-30)/10,"x",(s-3)/10,"x",brfd,"kom.(2D i 2K)"));  
pom=(v-c)/brf ;
  for(j=[0]){
translate([1.5,-d-mdf,c+j*pom])
cube(celo_duboke_fioke);} } 
}
//fioka_duboka
stranica_duboke_fioke=[m,kl-10,(v-c)/brf*2-100];
    echo(str("stranica_duboke_fioke  m:",((v-c)/brf*2-100)/10,"x",(kl-10)/10,"x",brfd*2,"kom.(2d i 2k)"));  
mstr_duboke_fioke=[s-2*m1-8-2*m,m1,(v-c)/brf*2-100-12-m1];
    echo(str("p/z_strane_duboke_fioke  m1:",(s-2*m1-8-2*m)/10,"x",((v-c)/brf*2-100-12-m1)/10,"x",brfd*2,"kom.(1d)"));
dno_fioka=[s-2*m1-8-2*m,kl-10,m1];
    echo(str("dno_duboke_fioke  m1:",(s-2*m1-8-2*m)/10,"x",(kl-10)/10,"x",brfd,"kom.(2d)"));
 if(fioke){
 pom=(v-c)/brf ;
  for(i=[0]){
   color(dezen_kutije){ 
translate([0,-d,c+12+i*pom])union(){   
translate([m1+4,0,m1+4])
cube(stranica_duboke_fioke);
translate([s-m1-4-m,0,m1+4])
cube(stranica_duboke_fioke);
translate([m1+4+m,0,m1+4+12+m1])
cube(mstr_duboke_fioke);
translate([m1+4+m,kl-10-m1,m1+4+12+m1])
cube(mstr_duboke_fioke);
translate([m1+4+m,0,m1+4+12])
color([0,1,0])
cube(dno_fioka);
      }        }
}
 }      
}
fioke_duboke(4,1,500);
module fioke_plitke(brf,brfp,kl){
//cela_plitkih_fioka
if(celafioka){
color(dezen_front){
 celo_plitke_fioke= [s-3,mdf,(v-c)/brf-18];
    echo(str("celo_plitke_fioke  mdf:",((v-c)/brf-18)/10,"x",(s-3)/10,"x",brfp,"kom.(2D i 2K)"));  
pomeriti=(v-c)/brf ;
  for(k=[2,2.92]){
translate([1.5,-d-mdf,c+k*pomeriti])
cube(celo_plitke_fioke);} } 
}
//fioka_plitka
stranica_plitke_fioke=[m,kl-10,(v-c)/brf-75];
    echo(str("stranica_plitke_fioke m:",((v-c)/brf-75)/10,"x",(kl-10)/10,"x",brfp*2,"kom.(2D i 2K)"));
mstr_plitke_fioke=[s-2*m1-8-2*m,m1,(v-c)/brf-75-12-m1];
    echo(str("p/z_strane_plitke_fioke  m1:",(s-2*m1-8-2*m)/10,"x",((v-c)/brf-75-12-m1)/10,"x",brfp*2,"kom.(1d)"));
dno_fioka=[s-2*m1-8-2*m,kl-10,m1];
    echo(str("dno_plitke_fioke  m1:",(s-2*m1-8-2*m)/10,"x",(kl-10)/10,"x",brfp,"kom.(2d)"));
 if(fioke){
 pom=(v-c)/brf ;
  for(i=[2,2.85]){
   color(dezen_kutije){ 
translate([0,-d,c+12+i*pom])union(){   
translate([m1+4,0,m1+4])
cube(stranica_plitke_fioke);
translate([s-m1-4-m,0,m1+4])
cube(stranica_plitke_fioke);
translate([m1+4+m,0,m1+4+12+m1])
cube(mstr_plitke_fioke);
translate([m1+4+m,kl-10-m1,m1+4+12+m1])
cube(mstr_plitke_fioke);
translate([m1+4+m,0,m1+4+12])
color([0,1,0])
cube(dno_fioka);
        }      }
}
 }      
}
fioke_plitke(4,2,500);

}
*fiokar_gola(700,880,550,c,3,2,1);
module radni_stol(s,v,d,c,brvr){
module kutija(){
    
 stranice=[m1,d,v-c];echo(str("stranice m1:",(v-c)/10,"x",d/10,"x 2kom. (1d i 2k)")); 
 dno=[s-2*m1,d,m1];echo(str("dno m1:",(s-2*m1)/10,"x",d/10,"x 1kom. (1d) "));    
 traverzne=[s-2*m1,70,m1];echo(str("traverzne m1:",(s-2*m1)/10,"x",70/10,"x 1kom. (2d) "));    
 lesonit=[s,hdf,v-c];echo(str("lesonit :",s/10,"x",(v-c)/10,"x 1kom."));        
   color(dezen_kutije){    
 translate([0,-d,c])cube(stranice);   
 translate([s-m1,-d,c]) cube(stranice);     
 translate([m1,-d,c]) cube(dno);     
 translate([m1,-70,v-m1]) cube(traverzne);
 translate([m1,-d,v-m1-50]) cube(traverzne);
if(pozadina){    
 translate([0,0,c]) cube(lesonit);
}  } }

kutija();    
module police(brp){   
police=[s-2*m1,d-50,m1];echo(str("police m1:",(s-2*m1)/10,"x",(d-50)/10,"x",brp,"kom.(1d)")); 
if(polica) {    
rasporedi_police=(v-c-m1)/(brp+1);
for(i=[1:brp])
 color(dezen_kutije)
translate([m1,-d+50,c+i*rasporedi_police]) cube(police);
}
}    
police(1);

module vrata(brv){
color(dezen_front){
 vrata=[s/brv-3,mdf,v-c-3];echo(str("vrata mdf:",(v-c-3)/10,"x",(s/brv-3)/10,"x",brv,"kom.(2D i 2K)"));
if(front_vrata){    
rasporedi_vrata=s/brv;
for(i=[0:(brv-1)])
translate([1.5+i*rasporedi_vrata,-d-mdf,c])cube(vrata);

  }  
}
    postavi_rucke=50*brv;
for(j=[0:(brv-1)])
translate([s/brv-50+j*postavi_rucke,-d-mdf,v-186/2-50])cevasta_rucka(186,25,8);}
vrata(brvr);

}
*radni_stol(700,820,550,c,2);
module gola_radni_stol(s,v,d,c,brp,brvr){
module kutija(){
    
 stranice=[m1,d,v-c];echo(str("stranice m1:",(v-c)/10,"x",d/10,"x 2kom. (1d i 2k)")); 
 dno=[s-2*m1,d,m1];echo(str("dno m1:",(s-2*m1)/10,"x",d/10,"x 1kom. (1d) "));    
 traverzne=[s-2*m1,70,m1];echo(str("traverzne m1:",(s-2*m1)/10,"x",70/10,"x 1kom. (2d) "));    
 lesonit=[s,hdf,v-c];echo(str("lesonit :",s/10,"x",(v-c)/10,"x 1kom."));        
   color(dezen_kutije){    
 translate([0,-d,c])cube(stranice);   
 translate([s-m1,-d,c]) cube(stranice);     
 translate([m1,-d,c]) cube(dno);     
 translate([m1,-70,v-m1]) cube(traverzne);
 translate([m1,-d,v-m1-50]) cube(traverzne);
if(pozadina){    
 translate([0,0,c]) cube(lesonit);
}  } }

kutija();   
module police(){   
police=[s-2*m1,d-50,m1];echo(str("police :",(s-2*m1)/10,"x",(d-50)/10,"x",brp,"kom. 1d")); 
if(polica) {    
rasporedi_police=(v-c-m1)/(brp+1);
for(i=[1:brp])
color(dezen_kutije)
translate([m1,-d+50,c+i*rasporedi_police]) cube(police);
}
}    
police();

module vrata(brv){
color(dezen_front){
 vrata=[s/brv-3,mdf,v-c-33];echo(str("vrata :",(v-c-33)/10,"x",(s/brv-3)/10,"x",brv,"kom.(2D i 2K)"));
if(front_vrata){    
rasporedi_vrata=s/brv;
for(i=[0:(brv-1)])
translate([1.5+i*rasporedi_vrata,-d-mdf,c])cube(vrata);    
  }  
}}
vrata(brvr);

}
*gola_radni_stol(700,880,550,c,1,2);
module vrata_sudo_masine(s,v,d,c){
color(dezen_front){
 vrata_sudo_masine=[s-3,mdf,v-c-3];echo(str("vrata mdf:",(v-c-3)/10,"x",(s-3)/10,"x 1kom.(2D i 2K)"));
if(front_vrata){    

translate([1.5,-d-mdf,c])cube(vrata_sudo_masine);   
  }  }
translate([s/2,-d-mdf,v-50])cevasta_rucka_horizontala(186,25,8);     }
*vrata_sudo_masine(600,820,550,c);
module vrata_sudo_masine_gola(s,v,d,c){
color(dezen_front){
 vrata_sudo_masine=[s-3,mdf,v-c-33];echo(str("vrata mdf:",(v-c-33)/10,"x",(s-3)/10,"x 1kom.(2D i 2K)"));
if(front_vrata){    

translate([1.5,-d-mdf,c])cube(vrata_sudo_masine);    
  }  
}}
*vrata_sudo_masine_gola(600,880,550,c);
module radni_stol_rerne(s,v,d,c,rerna){
module kutija(){
    
 stranice=[m1,d,v-c];echo(str("stranice m1:",(v-c)/10,"x",d/10,"x 2kom. (1d i 2k)")); 
 dno=[s-2*m1,d,m1];echo(str("dno m1:",(s-2*m1)/10,"x",d/10,"x 2kom. (1d) "));    
 traverzne=[s-2*m1,70,m1];echo(str("traverzne m1:",(s-2*m1)/10,"x",70/10,"x 2kom. 2d "));    
 lesonit=[s,hdf,v-c];echo(str("lesonit hdf:",s/10,"x",(v-c)/10,"x 1kom."));        
   color(dezen_kutije){    
 translate([0,-d,c])cube(stranice);   
 translate([s-m1,-d,c]) cube(stranice);     
 translate([m1,-d,c]) cube(dno);
  translate([m1,-d,v-2*m1-rerna]) cube(dno);     
 translate([m1,-70,v-m1]) cube(traverzne);
 translate([m1,-d,v-m1]) cube(traverzne);
if(pozadina){    
 translate([0,0,c]) cube(lesonit);
}  } }

kutija();  

module fioke_plitke(s,v,d,c,rerna,kl){

//cela_plitkih_fioka
if(celafioka){
color(dezen_front){
 celo_fioke= [s-3,mdf,v-c-m1-rerna-3]; echo(str("celo__fioke mdf:",(v-c-m1-rerna-3)/10,"x",(s-3)/10,"x 1kom.(2D i 2K)"));  
translate([1.5,-d-mdf,c])
cube(celo_fioke); }
translate([s/2,-d-mdf,c+(v-c-m1-rerna-50)])cevasta_rucka_horizontala(186,25,8);
}
//fioka_plitka
stranica_fioke=[m1,kl,v-c-3*m1-rerna-21];echo(str("stranica__fioke m:",kl/10,"x",(v-c-3*m1-rerna-21)/10,"x 1kom.(1d)")); 
mstr_fioke=[s-2*m1-25-2*m1,m1,v-c-3*m1-rerna-21];echo(str("stranica__fioke m1:",(s-2*m1-25-2*m1)/10,"x",(v-c-3*m1-rerna-21)/10,"x 1kom.(1d)")); 
lesonit_dno_fioke=[s-2*m1-25,kl,hdf];echo(str("lesonit_dno_fioke hdf:",(s-2*m1-25)/10,"x",kl/10,"x 1kom."))

 if(fioke){
 color(dezen_kutije)
translate([0,-d,c+10])union(){   
translate([m1+25/2,0,m1+5])
cube(stranica_fioke);
translate([s-2*m1-25/2,0,m1+5])
cube(stranica_fioke);
translate([m1+25/2+m1,0,m1+5])
cube(mstr_fioke);
translate([m1+25/2+m1,kl-m1,m1+5])
cube(mstr_fioke);
translate([m1+25/2,0,m1+5-hdf])
color([0,1,0])
cube(lesonit_dno_fioke);
              }

 }      
}

fioke_plitke(600,v,550,c,585,500);


}

*radni_stol_rerne(600,820,550,c,585);
module radni_stol_rerne_gola(s,v,d,c,rerna){
module kutija(){

 stranice=[m1,d,v-c];echo(str("stranice m1:",(v-c)/10,"x",d/10,"x 2kom. (1d i 2k)")); 
 dno=[s-2*m1,d,m1];echo(str("dno m1:",(s-2*m1)/10,"x",d/10,"x 2kom. (1d) "));    
 traverzne=[s-2*m1,70,m1];echo(str("traverzne m1:",(s-2*m1)/10,"x",70/10,"x 2kom. (2d)"));    
 lesonit=[s,hdf,v-c];echo(str("lesonit :",s/10,"x",(v-c)/10,"x 1kom."));    
    color(dezen_kutije){    
 translate([0,-d,c])cube(stranice);   
 translate([s-m1,-d,c]) cube(stranice);     
 translate([m1,-d,c]) cube(dno);
  translate([m1,-d,v-2*m1-rerna-40]) cube(dno);     
 translate([m1,-70,v-m1]) cube(traverzne);
 translate([m1,-d,v-m1-40]) cube(traverzne);
if(pozadina){    
 translate([0,0,c]) cube(lesonit);
}  } }

kutija(); 

module fioke_plitke(s,v,d,c,rerna,kl){

//cela_plitkih_fioka
if(celafioka){
color(dezen_front){
 celo_fioke= [s-3,mdf,v-c-60-rerna-3]; echo(str("celo__fioke mdf:",(v-c-m1-rerna-3)/10,"x",(s-3)/10,"x 1kom.(2D i 2K)"));  
translate([1.5,-d-mdf,c])
cube(celo_fioke); } 
}
//fioka_plitka
stranica_fioke=[m1,kl,v-c-3*m1-rerna-42-21];echo(str("stranica__fioke m1:",kl/10,"x",(v-c-3*m1-rerna-21)/10,"x 1kom.(1d)")); 
mstr_fioke=[s-2*m1-25-2*m1,m1,v-c-3*m1-rerna-42-21];echo(str("p/z_stranica_fioke m1:",(s-2*m1-25-2*m1)/10,"x",(v-c-3*m1-rerna-21)/10,"x 1kom.(1d)")); 
lesonit_dno_fioke=[s-2*m1-25,kl,hdf];echo(str("lesonit_dno_fioke  :",(s-2*m1-25)/10,"x",kl/10,"x 1kom."))

 if(fioke){
 color(dezen_kutije)
translate([0,-d,c+10])union(){   
translate([m1+25/2,0,m1+5])
cube(stranica_fioke);
translate([s-2*m1-25/2,0,m1+5])
cube(stranica_fioke);
translate([m1+25/2+m1,0,m1+5])
cube(mstr_fioke);
translate([m1+25/2+m1,kl-m1,m1+5])
cube(mstr_fioke);
translate([m1+25/2,0,m1+5-hdf])
color([0,1,0])
cube(lesonit_dno_fioke);
              }

 }      
}

fioke_plitke(600,880,550,100,585,500);

}
*radni_stol_rerne_gola(600,880,550,c,585);
module radni_stol_rerne_gola_bez_fioke(s,v,d,c,rerna){
module kutija(){
    
 stranice=[m1,d,v-c];echo(str("stranice m1:",(v-c)/10,"x",d/10,"x 2kom. (1d i 2k)")); 
 dno=[s-2*m1,d,m1];echo(str("dno m1:",(s-2*m1)/10,"x",d/10,"x 2kom. (1d) "));    
 traverzne=[s-2*m1,70,m1];echo(str("traverzne m1:",(s-2*m1)/10,"x",70/10,"x 2kom. (2d) "));
frontovi=[s-3,mdf,(v-c-rerna)/2-3];    
 lesonit=[s,hdf,v-c];echo(str("lesonit hdf:",s/10,"x",(v-c)/10,"x 1kom."));    
     
 translate([0,0,c])cube(stranice);   
 translate([s-m1,0,c]) cube(stranice);     
 translate([m1,0,c]) cube(dno);
 #translate([m1,0,c+m1+80-m1]) cube(dno);    
 translate([m1,d-70,v-m1]) cube(traverzne);
 translate([m1,0,v-60]) cube(traverzne);
 translate([1.5,-mdf,c])cube(frontovi);
 translate([1.5,-mdf,v-30-(v-c-rerna)/2])cube(frontovi);   
    
    
if(pozadina){    
 translate([0,d,c]) cube(lesonit);
}  }

kutija(); 
module ploca_za_kuvanje(s,d,v){
rigle=[s,d,v];
color("black")translate([10,50,885])cube(rigle);
}
ploca_za_kuvanje(580,490,40);

    // 1. COKLA I NOGARI
    cokla(s, d, c, mdf, dezen_front);
}
*radni_stol_rerne_gola_bez_fioke(600,880,550,c,585);
module dug_element_90(dss,lss,v,d,c,brp){
module kutija(){
 
stranice=[m1,d,v-c];echo(str("stranice m1:",(v-c)/10,"x",d/10,"x 3kom. (1d i 2k)")); 
 dno=[dss-2*m1,d,m1];echo(str("dno m1:",(dss-2*m1)/10,"x",d/10,"x 1kom. (1d) ")); 
 dno_krace=[d,lss-d-m1,m1];echo(str("dno krace m1:",(lss-d-m1)/10,"x",d/10,"x 1kom. (1d) "));    
 traverzne=[dss-2*m1,70,m1];echo(str("traverzne m1:",(dss-2*m1)/10,"x",70/10,"x 2kom. (2d) "));
 traverzne_krace=[70,lss-d-m1,m1];echo(str("traverzne krace m1:",(lss-d-m1)/10,"x",70/10,"x 2kom. (2d) "));    
 lesonit=[dss,hdf,v-c];echo(str("lesonit hdf:",dss/10,"x",(v-c)/10,"x 1kom."));
 lesonit_uzi=[hdf,lss-d+30,v-c];echo(str("lesonit hdf:",(lss-d+30)/10,"x",(v-c)/10,"x 1kom."));    
  color(dezen_kutije) {  
 translate([0,-d,c])cube(stranice);   
 translate([dss-m1,-d,c]) cube(stranice);     
 rotate([0,0,90])translate([-lss,-d,c])cube(stranice);
 translate([m1,-d,c]) cube(dno);
 translate([0,-lss+m1,c])cube(dno_krace);   
 translate([m1,-70,v-m1]) cube(traverzne);
 translate([m1,-d,v-m1]) cube(traverzne);
 translate([0,-lss+m1,v-m1])cube(traverzne_krace);   
 translate([d-70,-lss+m1,v-m1])cube(traverzne_krace);    
if(pozadina){    
 translate([0,0,c]) cube(lesonit);
 translate([-hdf,-lss,c])cube(lesonit_uzi);   
}  }}

kutija();

module police(){   
police=[dss-2*m1,d-50,m1];echo(str("police :",(dss-2*m1)/10,"x",(d-50)/10,"x",brp,"kom. 1d"));
police_krace=[d-50,lss-m1-d+50,m1];echo(str("police :",(lss-m1-d+50)/10,"x",(d-50)/10,"x",brp,"kom. 1d i 1k"))   
    
if(polica) {    
rasporedi_police=(v-c-m1)/(brp+1);
for(i=[1:brp]){
color(dezen_kutije){
translate([m1,-d+50,c+i*rasporedi_police]) cube(police);
translate([0,-lss+m1,c+i*rasporedi_police]) cube(police_krace);
}}
}
}    
police();

module vrata(){
color(dezen_front){
 vrata_d=[dss-d-mdf-3,mdf,v-c-3];echo(str("vrata_d mdf :",(v-c-3)/10,"x",(dss-d-3)/10,"x 2kom.(2D i 2K)"));
  vrata_l=[lss-d-mdf-3,mdf,v-c-3];echo(str("vrata_l mdf :",(v-c-3)/10,"x",(lss-d-3)/10,"x 2kom.(2D i 2K)"));   

if(front_vrata){    
translate([1.5+d+mdf,-d-mdf,c])cube(vrata_d); 
 rotate([0,0,90])translate([-lss+1.5,-d-mdf,c])cube(vrata_l); }}
translate([dss-50,-d-mdf,v-186/2-50])cevasta_rucka(186,25,8);   
    
}
vrata();


module cokla(){
 cokla=[dss-d+28,mdf,c-5];echo(str("cokla mdf:",(dss-d+28)/10,"x",(c-5)/10,"x 1kom.(2d i 2k)"));
 cokla_kraca=[lss-d+10,mdf,c-5];echo(str("cokla kraca mdf:",(lss-d+28)/10,"x",(c-5)/10,"x 1kom.(2d i 2k)"));
 color(dezen_front){
rotate([0,0,90])translate([d-lss,-d+10,5])cube(cokla_kraca);    
translate([d-10-m1,10,5])cube(cokla);}
translate([30,55,0])cylinder(c,15,15);
translate([dss-30,55,0])cylinder(c,15,15);
translate([30,d-55,0])cylinder(c,15,15);
translate([dss-30,d-55,0])cylinder(c,15,15);
translate([d-55,d-lss+30,0])cylinder(c,15,15); 
translate([30,d-lss+30,0])cylinder(c,15,15);
translate([d-55,-30,0])cylinder(c,15,15);
translate([d+55,55,0])cylinder(c,15,15);     
}
*cokla();
}
*dug_element_90(800,900,820,550,c,1);
module dug_element_90_gola(dss,lss,v,d,c,brp){
module kutija(){
 
stranice=[m1,d,v-c];echo(str("stranice m1:",(v-c)/10,"x",d/10,"x 3kom. (1d i 2k)")); 
 dno=[dss-2*m1,d,m1];echo(str("dno m1:",(dss-2*m1)/10,"x",d/10,"x 1kom. (1d) ")); 
 dno_krace=[d,lss-d-m1,m1];echo(str("dno krace m1:",(lss-d-m1)/10,"x",d/10,"x 1kom. (1d) "));    
 traverzne=[dss-2*m1,70,m1];echo(str("traverzne m1:",(dss-2*m1)/10,"x",70/10,"x 2kom. (2d) "));
 traverzna2=[70,lss-m1-70,m1];echo(str("traverzna2 m1:",(lss-m1-70)/10,"x",70/10,"x 2kom. (2d) "));    
 traverzne_krace=[70,lss-d-m1,m1];echo(str("traverzne krace m1:",(lss-d-m1)/10,"x",70/10,"x 2kom. (2d) "));    
 lesonit=[dss,hdf,v-c];echo(str("lesonit hdf:",dss/10,"x",(v-c)/10,"x 1kom."));
 lesonit_uzi=[hdf,lss-d+30,v-c];echo(str("lesonit hdf:",(lss-d+30)/10,"x",(v-c)/10,"x 1kom."));    
  color(dezen_kutije) {  
 translate([0,-d,c])cube(stranice);   
 translate([dss-m1,-d,c]) cube(stranice);     
 rotate([0,0,90])translate([-lss,-d,c])cube(stranice);
 translate([m1,-d,c]) cube(dno);
 translate([0,-lss+m1,c])cube(dno_krace);   
 translate([m1,-70,v-m1]) cube(traverzne);
 translate([m1,-d,v-50]) cube(traverzne);
 translate([0,-lss+m1,v])rotate([0,90,0])cube(traverzne_krace); 
 translate([m1,-lss+m1,v-m1])cube(traverzna2);   
 translate([d-70,-lss+m1,v-50])cube(traverzne_krace);    
if(pozadina){    
 translate([0,0,c]) cube(lesonit);
 translate([-hdf,-lss,c])cube(lesonit_uzi);   
}  }}

kutija();

module police(){   
police=[dss-2*m1,d-50,m1];echo(str("police m1:",(dss-2*m1)/10,"x",(d-50)/10,"x",brp,"kom. (1d)"));
police_krace=[d-50,lss-m1-d+50,m1];echo(str("police m1:",(lss-m1-d+50)/10,"x",(d-50)/10,"x",brp,"kom. (1d i 1k)"))   
    
if(polica) {    
rasporedi_police=(v-c-m1)/(brp+1);
for(i=[1:brp]){
    color(dezen_kutije){
translate([m1,-d+50,c+i*rasporedi_police]) cube(police);
translate([0,-lss+m1,c+i*rasporedi_police]) cube(police_krace);}
}
}
}    
police();

module vrata(){
color(dezen_front){
 vrata_d=[dss-d-mdf-3,mdf,v-c-33];echo(str("vrata d mdf:",(v-c-3)/10,"x",(dss-d-3)/10,"x 1kom.(2d i 2k)"));
  vrata_l=[lss-d-mdf-3,mdf,v-c-33];echo(str("vrata l mdf:",(v-c-3)/10,"x",(lss-d-3)/10,"x 1kom.(2d i 2k)"));   

if(front_vrata){    
translate([1.5+d+mdf,-d-mdf,c])cube(vrata_d); 
rotate([0,0,90])translate([-lss+1.5,-d-mdf,c])cube(vrata_l);   
  }  
}}
vrata();


module cokla(){
 cokla=[dss-d+28,mdf,c-5];echo(str("cokla mdf:",(dss-d+28)/10,"x",(c-5)/10,"x 1kom.(2d i 2k)"));
 cokla_kraca=[lss-d+10,mdf,c-5];echo(str("cokla kraca mdf:",(lss-d+28)/10,"x",(c-5)/10,"x 1kom.(2d i 2k)"));
color(dezen_front){
rotate([0,0,90])translate([d-lss,-d+10,5])cube(cokla_kraca);   
translate([d-10-m1,10,5])cube(cokla);}
translate([30,55,0])cylinder(100,15,15);
translate([dss-30,55,0])cylinder(100,15,15);
translate([30,d-55,0])cylinder(100,15,15);
translate([dss-30,d-55,0])cylinder(100,15,15); 
translate([d-55,d-lss+30,0])cylinder(100,15,15); 
translate([30,d-lss+30,0])cylinder(100,15,15);
translate([d-55,-30,0])cylinder(100,15,15);
translate([d+55,55,0])cylinder(100,15,15);    
}
*cokla();
}
*dug_element_90_gola(1000,800,880,550,c,1);
module donji_ugaoni_element_45_sa_plocom(dss,lss,v,d,c){

sirina_vrati=sqrt(((lss-m1-d)*(lss-m1-d)
)+((dss-m1-d)*(dss-m1-d)))-3; 


//radna ploca
if(radna_ploca)
{

#translate([0,0,v])
linear_extrude(rpl) polygon(points=[[0,0],[0,-lss],[600,-lss],[dss,-600],[dss,0]]);
}
//stranice
stranica=[m1,d,v -c];echo(str("stranice m1:",(v-c)/10,"x",d/10,"x 2kom. (1d i 2k)"));
translate([dss-m1,-d,c])
    cube(stranica);
translate([d,-lss,c])rotate([0,0,90])
    cube(stranica);
echo(str("dno m1:",(dss-m1)/10,"x",(lss-m1)/10,"x 1kom. (sece se kosina i kantuje)"));
translate([0,0,c])
linear_extrude(m1) polygon(points=[[0,0],[0,-lss+m1],[d,-lss+m1],[dss-m1,-d],[dss-m1,0]]);
stranica_u_uglu=[150,m1,v-c-2*m1];echo(str("stranice ugla m1:",(v-c-2*m1)/10,"x",150/10,"x 1kom. (1d) "));
translate([0,-m1,m1+c])
   cube(stranica_u_uglu);
traverzna_kraca=[lss-m1,70,m1];echo(str("traverzne krace m1:",(lss-m1-70)/10,"x",70/10,"x 1kom. (2d) "));
translate([70,-lss+m1,v-m1])rotate([0,0,90])
   cube(traverzna_kraca);
traverzna=[dss-70-m1,70,m1];     echo(str("traverzne m1:",(dss-2*m1)/10,"x",70/10,"x 1kom. (2d) "));
translate([70,-70,v -m1])
   cube(traverzna);
 //polica 
if(polica){
 polica=[d-50,lss-m1];   echo(str("police m1:",(lss-m1)/10,"x",(d-50)/10,"x 1kom. (1d)"))
translate([0,-lss+m1,c+(v-c)/2-m1])   
   cube([d,lss-m1,m1]);
}
 //sirina_vrati
polozaj_vrati=atan((lss-d)/(dss-d));
vrata=[sirina_vrati,mdf,v-c-3];echo(str("vrata mdf:",(v-c-3)/10,"x",(sirina_vrati)/10,"x 1kom. (2D i 2K)"));
if(front_vrata){
color(dezen_front){ 
translate([d+m1/1.4,-lss+5,c])
rotate([0,0,polozaj_vrati])
  cube(vrata);
}

translate([dss-50,-d-50,v-186/2-50])rotate([0,0,polozaj_vrati])cevasta_rucka(186,25,8); }
 //lesonit 
      echo(str("lesonit hdf:",(lss)/10,"x",(v-c)/10,"x 1kom."));echo(str("lesonit hdf:",(dss)/10,"x",(v-c)/10,"x 1kom."));
if(pozadina){
translate([-hdf,-lss,c])   
   cube([hdf,lss,v-c]);
translate([0,0,c])
   cube([dss,hdf,v-c]);
}
module cokla(){
 duzina_cokle=sqrt(((lss-d+m1+10)^2)+((dss-d+m1+10)^2))-3;    
    
 cokla=[duzina_cokle,mdf,c-5];echo(str("cokla mdf:",(duzina_cokle)/10,"x",(c-5)/10,"x 1kom.(2d i 2k)"));
translate([d-30,-lss,5])rotate([0,0,polozaj_vrati])cube(cokla);   
%translate([30,-55,0])cylinder(c,15,15);
%translate([dss-30,-55,0])cylinder(c,15,15);
%translate([30,-lss+55,0])cylinder(c,15,15);
%translate([dss-30,-d+55,0])cylinder(c,15,15); 
%translate([d-55,-lss+30,0])cylinder(c,15,15); 
   
}
cokla();
}
*donji_ugaoni_element_45_sa_plocom(900,900,820,550,c); 
module donji_ugaoni_element_45_sa_plocom_gola(dss,lss,v,d,c){

sirina_vrati=sqrt(((lss-m1-d)*(lss-m1-d)
)+((dss-m1-d)*(dss-m1-d)))-3; 


//radna lpoca
if(radna_ploca)
{

#translate([0,0,v])
linear_extrude(rpl) polygon(points=[[0,0],[0,-lss],[600,-lss],[dss,-600],[dss,0]]);
}
//stranice
stranica=[m1,d,v -c];echo(str("stranice m1:",(v-c)/10,"x",d/10,"x 2kom. (1d i 2k)"));
translate([dss-m1,-d,c])
    cube(stranica);
translate([d,-lss,c])rotate([0,0,90])
    cube(stranica);
echo(str("dno m1:",(dss-m1)/10,"x",(lss-m1)/10,"x 1kom. (sece se kosina i kantuje)"));
translate([0,0,c])
linear_extrude(m1) polygon(points=[[0,0],[0,-lss+m1],[d,-lss+m1],[dss-m1,-d],[dss-m1,0]]);
stranica_u_uglu=[150,m1,v-c-2*m1];echo(str("stranica ugla m1:",(v-c-2*m1)/10,"x",150/10,"x 1kom. (1d) "));
translate([0,-m1,m1+c])
   cube(stranica_u_uglu);
traverzna_kraca=[lss-m1,70,m1];echo(str("traverzne krace m1:",(lss-m1-70)/10,"x",70/10,"x 1kom. (2d) "));
translate([70,-lss+m1,v-m1])rotate([0,0,90])
   cube(traverzna_kraca);
traverzna=[dss-70-m1,70,m1];     echo(str("traverzne m1:",(dss-2*m1)/10,"x",70/10,"x 1kom. (2d) "));
translate([70,-70,v -m1])
   cube(traverzna);
 //polica 
if(polica){
 polica=[d-50,lss-m1];   echo(str("police m1:",(lss-m1)/10,"x",(d-50)/10,"x 1kom. (1d)"))
translate([0,-lss+m1,c+(v-c)/2-m1])   
   cube([d,lss-m1,m1]);
}
 //sirina_vrati
polozaj_vrati=atan((lss-d)/(dss-d));
vrata=[sirina_vrati,mdf,v-c-33];echo(str("vrata mdf:",(v-c-33)/10,"x",(sirina_vrati)/10,"x 1kom. (2D i 2K)"));
if(front_vrata){
color(dezen_front){ 
translate([d+m1/1.4,-lss+5,c])
rotate([0,0,polozaj_vrati])
  cube(vrata);
} }
 //lesonit 
      echo(str("lesonit hdf:",(lss)/10,"x",(v-c)/10,"x 1kom."));echo(str("lesonit hdf:",(dss)/10,"x",(v-c)/10,"x 1kom."));
if(pozadina){
translate([-hdf,-lss,c])   
   cube([hdf,lss,v-c]);
translate([0,0,c])
   cube([dss,hdf,v-c]);
}
module cokla(){
 duzina_cokle=sqrt(((lss-d+m1+10)^2)+((dss-d+m1+10)^2))-3;    
    
 cokla=[duzina_cokle,mdf,c-5];echo(str("cokla mdf:",(duzina_cokle)/10,"x",(c-5)/10,"x 1kom.(2d i 2k)"));
translate([d-30,-lss,5])rotate([0,0,polozaj_vrati])color(dezen_front)cube(cokla);   
%translate([30,-55,0])cylinder(100,15,15);
%translate([dss-30,-55,0])cylinder(100,15,15);
%translate([30,-lss+55,0])cylinder(100,15,15);
%translate([dss-30,-d+55,0])cylinder(100,15,15); 
%translate([d-55,-lss+30,0])cylinder(100,15,15); 
   
}
cokla();
}
*donji_ugaoni_element_45_sa_plocom_gola(900,900,880,550,c); 

module radna_ploca(l=600, d=600, debljina=38) {
    // ... tvoj kod za modelovanje ...
    
    // DODAJ OVU LINIJU:
    echo(str("Radna ploca radna_ploca:", l/10, "x", d/10, "x 1kom. (/)"));
    
    color(dezen_radne_ploce) cube([l, d, debljina]);
}
module cokla(l=600, h=100, debljina=18) {
    // ... tvoj kod za modelovanje ...
    
    // DODAJ OVU LINIJU (ovde stavljamo mdf kao materijal):
    echo(str("Cokla mdf:", l/10, "x", h/10, "x 1kom. (2D i 2K)"));
    
    color(dezen_cokle) cube([l, debljina, h]);
}

//gornji kuhinjski elementi
    
module klasicna_viseca(s,v,d,brp,brvr){

module kutija(){

 stranice=[m1,d,v];echo(str("stranice m1:",(v)/10,"x",d/10,"x 2kom. (1d i 2k)")); 
 dno_i_plafon=[s-2*m1,d,m1];echo(str("dno i plafon m1:",(s-2*m1)/10,"x",d/10,"x 1kom. (1d) "));        
 lesonit=[s,hdf,v];echo(str("lesonit hdf:",s/10,"x",(v)/10,"x 1kom."));        
 color(dezen_kutije){    
 translate([0,-d,0])cube(stranice);   
 translate([s-m1,-d,0]) cube(stranice);     
 translate([m1,-d,0]) cube(dno_i_plafon);     
 translate([m1,-d,v-m1]) cube(dno_i_plafon);
if(pozadina){    
 translate([0,0,0]) cube(lesonit);
} }
module police(){   
police=[s-2*m1,d-30,m1];echo(str("police m1:",(s-2*m1)/10,"x",(d-30)/10,"x",brp,"kom. (1d)")); 
if(polica) {    
rasporedi_police=(v-m1)/(brp+1);
for(i=[1:brp])
color(dezen_kutije)translate([m1,-d+30,i*rasporedi_police]) cube(police);
}
}    
police();
}
kutija(); 

module vrata(brv){
 vrata=[s/brv-3,mdf,v-3];echo(str("vrata mdf:",(v-3)/10,"x",(s/brv-3)/10,"x",brv,"kom.(2d i 2k)"));
if(front_vrata){
color(dezen_front1){    
rasporedi_vrata=s/brv;
for(i=[0:(brv-1)])
translate([1.5+i*rasporedi_vrata,-d-mdf,0])cube(vrata);    
  }
      postavi_rucke=50*brv;
for(j=[0:(brv-1)])
translate([s/brv-50+j*postavi_rucke,-d-mdf,186/2+50])cevasta_rucka(186,25,8); } 
}
vrata(brvr);
}
*klasicna_viseca(800,1000,350,2,2);    
module klasicna_viseca_gola(s,v,d,brp,brvr){

module kutija(){

 stranice=[m1,d,v];echo(str("stranice m1:",(v)/10,"x",d/10,"x 2kom. (1d i 2k)"));
dno=[s-2*m1,d-22,m1];echo(str(" dno m1:",(s-2*m1)/10,"x",(d-22)/10,"x 1kom. (1d) "));    
plafon=[s-2*m1,d,m1];echo(str(" plafon m1:",(s-2*m1)/10,"x",d/10,"x 1kom. (1d) "));        
 lesonit=[s,hdf,v];echo(str("lesonit hdf:",s/10,"x",(v)/10,"x 1kom."));        
 color(dezen_kutije){    
 translate([0,-d,0])cube(stranice);   
 translate([s-m1,-d,0]) cube(stranice);     
 translate([m1,-d,0]) cube(dno);     
 translate([m1,-d,v-m1]) cube(plafon);
if(pozadina){    
 translate([0,0,0]) cube(lesonit);
} }
module police(){   
police=[s-2*m1,d-30,m1];echo(str("police m1:",(s-2*m1)/10,"x",(d-30)/10,"x",brp,"kom. (1d)")); 
if(polica) {    
rasporedi_police=(v-m1)/(brp+1);
for(i=[1:brp])
 color(dezen_kutije)   
translate([m1,-d+30,i*rasporedi_police]) cube(police);
}
}    
police();
}
kutija(); 

module vrata(brv){
 vrata=[s/brv-3,mdf,v-3];echo(str("vrata mdf:",(v-3)/10,"x",(s/brv-3)/10,"x",brv,"kom.(2d i 2k)"));
if(front_vrata){ 
color(dezen_front1){     
rasporedi_vrata=s/brv;
for(i=[0:(brv-1)])
translate([1.5+i*rasporedi_vrata,-d-mdf,0])cube(vrata);    
  }  }
}
vrata(brvr);
}
*klasicna_viseca_gola(300,800,350,2,1);
module klasicna_viseca_gola_ispod_grede(s,v,d,brp,brvr){

module kutija(){
sirina_grede=300;visina_grede=210;
 stranice=[m1,d,v];echo(str("stranice m1:",(v)/10,"x",d/10,"x 2kom. (1d i 2k)"));
dno=[s-2*m1,d-22,m1];echo(str(" dno m1:",(s-2*m1)/10,"x",(d-22)/10,"x 1kom. (1d) "));    
plafon=[s-2*m1,d,m1];echo(str(" plafon m1:",(s-2*m1)/10,"x",d/10,"x 1kom. (1d) "));        
 lesonit=[s,hdf,v-visina_grede];echo(str("lesonit hdf:",s/10,"x",(v-visina_grede)/10,"x 1kom."));        
  color(dezen_kutije)   {
 translate([0,-d,0])cube(stranice);   
 translate([s-m1,-d,0]) cube(stranice);     
 translate([m1,-d+22,0]) cube(dno);     
 translate([m1,-d,v-visina_grede-m1]) cube(plafon);
if(pozadina){    
 translate([0,0,0]) cube(lesonit);
} }
module police(){   
police=[s-2*m1,d-30,m1];echo(str("police m1:",(s-2*m1)/10,"x",(d-30)/10,"x",brp,"kom. (1d)")); 
if(polica) {    
rasporedi_police=(v-visina_grede-m1)/(brp+1);
for(i=[1:brp])
 color(dezen_kutije)   
translate([m1,-d+30,i*rasporedi_police]) cube(police);
}
}    
police();
}
kutija(); 

module vrata(brv){
    sirina_grede=300;visina_grede=210;
 vrata=[s/brv-3,mdf,v-visina_grede-3];echo(str("vrata mdf:",(v-visina_grede-3)/10,"x",(s/brv-3)/10,"x",brv,"kom.(2d i 2k)"));
if(front_vrata){
color(dezen_front1){     
rasporedi_vrata=s/brv;
for(i=[0:(brv-1)])
translate([1.5+i*rasporedi_vrata,-d-mdf,0])cube(vrata);    
  }  }
}
vrata(brvr);
}
*klasicna_viseca_gola_ispod_grede(350,800,350,2,2);
module viseca_na_kipu(s,v,d,brp,brvr){

module kutija(){

 stranice=[m1,d,v];echo(str("stranice m1:",(v)/10,"x",d/10,"x 2kom. (1d i 2k)"));
   
plafon_dno_i_srednja_vezna=[s-2*m1,d,m1];echo(str(" plafon i srednja vezna m1:",(s-2*m1)/10,"x",d/10,"x 2kom. (1d) "));        
 lesonit=[s,hdf,v];echo(str("lesonit hdf:",s/10,"x",(v)/10,"x 1kom."));  
color(dezen_kutije) {   
 translate([0,-d,0])cube(stranice);   
 translate([s-m1,-d,0]) cube(stranice);     
 translate([m1,-d,0]) cube(plafon_dno_i_srednja_vezna); 
 translate([m1,-d,v-m1]) cube(plafon_dno_i_srednja_vezna);   
 translate([m1,-d,(v-m1)/2]) cube(plafon_dno_i_srednja_vezna);
if(pozadina){    
 translate([0,0,0]) cube(lesonit);
} }
module police(){   
police=[s-2*m1,d-30,m1];echo(str("police m1:",(s-2*m1)/10,"x",(d-30)/10,"x",brp,"kom. (1d)")); 
if(polica) {    
rasporedi_police=((v-m1)/2)/2;
for(i=[1,3])
color(dezen_kutije)
translate([m1,-d+30,i*rasporedi_police]) cube(police);
}
}    
police();
}
kutija(); 

module vrata(brv){
 vrata=[s-3,mdf,v/2-3];echo(str("vrata mdf:",(v/2-3)/10,"x",(s-3)/10,"x",brv,"kom.(2d i 2k)"));
if(front_vrata){ 
color(dezen_front1){     
rasporedi_vrata=v/brv;
for(i=[0:(brv-1)])
translate([1.5,-d-mdf,1.5+i*rasporedi_vrata])cube(vrata);    
  }
rasporedi_vrata=v/brv;
  for(j=[0:(brv-1)])
translate([s/2,-d-mdf,50+j*rasporedi_vrata])cevasta_rucka_horizontala(186,25,8); 
  }  
}
vrata(brvr);
}
*viseca_na_kipu(800,1000,350,2,2); 
module viseca_na_kipu_gola(s,v,d,brp,brvr){

module kutija(){
 stranice=[m1,d,v];echo(str("stranice m1:",(v)/10,"x",d/10,"x 2kom. (1d i 2k)"));
dno=[s-2*m1,d-22,m1];echo(str(" dno m1:",(s-2*m1)/10,"x",(d-22)/10,"x 1kom. (1d) "));    
plafon_i_srednja_vezna=[s-2*m1,d,m1];echo(str(" plafon i srednja vezna m1:",(s-2*m1)/10,"x",d/10,"x 2kom. (1d) "));        
 lesonit=[s,hdf,v];echo(str("lesonit hdf:",s/10,"x",(v)/10,"x 1kom."));        
 color(dezen_kutije){   
 translate([0,-d,0])cube(stranice);   
 translate([s-m1,-d,0]) cube(stranice);     
 translate([m1,-d+22,0]) cube(dno); 
 translate([m1,-d,v-m1]) cube(plafon_i_srednja_vezna);   
 translate([m1,-d,(v-m1)/2]) cube(plafon_i_srednja_vezna);
if(pozadina){    
 translate([0,0,0]) cube(lesonit);
} }
module police(){   
police=[s-2*m1,d-30,m1];echo(str("police m1:",(s-2*m1)/10,"x",(d-30)/10,"x",brp,"kom. (1d)")); 
if(polica) {    
rasporedi_police=((v-m1)/2)/2;
for(i=[1,3])
color(dezen_kutije)
translate([m1,-d+30,i*rasporedi_police]) cube(police);
}
}    
police();
}
kutija(); 

module vrata(brv){
 vrata=[s-3,mdf,v/2-3];echo(str("vrata mdf:",(v/2-3)/10,"x",(s-3)/10,"x",brv,"kom.(2d i 2k)"));
if(front_vrata){
color(dezen_front1){    
rasporedi_vrata=v/brv;
for(i=[0:(brv-1)])
translate([1.5,-d-mdf,1.5++i*rasporedi_vrata])cube(vrata);    
  } } 
}
vrata(brvr);
}
*viseca_na_kipu_gola(800,800,350,2,2); 
module gue90(sl,sd,v,d,brp){

echo(str("stranice m1: ",v/10,"x",d/10,"x",3,"kom.(1d i 2k)"));
echo(str("siri_pod_i_plafon m1: ",(sl-2*m1)/10,"x",d/10,"x",2,"kom.(1d)"));
echo(str("uzi_pod_i_plafon m1: ",(sd-d-m1)/10,"x",d/10,"x",2,"kom.(1d i 1k)"));
echo(str("polica duze m1: ",(sl-2*m1)/10,"x",(d-30)/10,"x",brp,"kom. x (1d i 1k)"));
echo(str("polica krace m1: ",(sd-d+30-m1)/10,"x",(d-30)/10,"x",brp,"kom. x (1d i 1k)"));
echo(str("vrata l mdf : ",(v-6)/10,"x",(sl-d-mdf-hdf-2)/10,"x",1,"kom. x  (2d i 2k)"));
echo(str("vrata d mdf: ",(v-6)/10,"x",(sd-d-mdf-hdf-2)/10,"x",1,"kom. x  ((2d i 2k))"));
echo(str("pozadina l hdf: ",v/10,"x",sl/10,"x",1,"kom.- hdf")); 
echo(str("pozadina d hdf: ",v/10,"x",(sd-d+25)/10,"x",1,"kom.")); 

stranice=[m1,d,v];
desna_stranica=[d,m1,v];
siri_pod=[sl-2*m1,d,m1];
kraci_pod=[d,sd-d-m1,m1];
duze_polica=[sl-2*m1,d-30,m1];
krace_polica=[d-30,sd-d+30-m1,m1];
vrata_l=[sl-d-mdf-hdf-2,m1,v-6];
vrata_d=[m1,sd-d-mdf-hdf-2,v-6];
pozadina_l=[sl,3,v ];
pozadina_d=[hdf,sd-d+20,v ];
color(dezen_kutije){
//stranice
translate([sl-m1,-d,0])
cube(stranice);
translate([0,-d,0])
cube(stranice);
translate([sl-d, -sd,0])
cube(desna_stranica);

//plafon i dno
translate([m1,-d,0])
cube(siri_pod);
translate([m1,-d,v-m1])
cube(siri_pod);
translate([sl-d,-sd+m1,0])
cube(kraci_pod);
translate([sl-d,-sd+m1,v-m1])
cube(kraci_pod);

            

//pozadina
if(pozadina){
translate([0,0,0])
   cube(pozadina_l);
translate([sl,-sd,0])
   cube(pozadina_d);   
}
// polica 
    
if(polica)
    {
      pomeriti = (v - m1) / (brp+1);
        echo(pomeriti)
      for (i = [1 : brp])
          {
            translate([m1,-d+30,+i * pomeriti])  
            cube(duze_polica);
            translate([sl-m1-d+30 ,-sd+m1,+i * pomeriti])  
            cube(krace_polica);   
              
              
   }           
              
          }
    }     

// Vrata
if(front_vrata)
{
color(dezen_front){
translate([1.5,-d-m1,3])
    cube(vrata_l);
translate([sl-d-mdf-hdf,-sd+1.5,3])
    cube(vrata_d);
    }
}
  }  
*gue90(600,900,800,350,2); 
module gue90rotiran(sl,sd,v,d,brp){

echo(str("stranice m1: ",v/10,"x",d/10,"x",3,"kom.(1d i 2k)"));
echo(str("siri_pod_i_plafon m1: ",(sl-2*m1)/10,"x",d/10,"x",2,"kom.(1d)"));
echo(str("uzi_pod_i_plafon m1: ",(sd-d-m1)/10,"x",d/10,"x",2,"kom.(1d i 1k)"));
echo(str("polica duze m1: ",(sl-2*m1)/10,"x",(d-30)/10,"x",brp,"kom. x (1d i 1k)"));
echo(str("polica krace m1: ",(sd-d+30-m1)/10,"x",(d-30)/10,"x",brp,"kom. x (1d i 1k)"));
echo(str("vrata l mdf : ",(v-6)/10,"x",(sl-d-mdf-hdf-2)/10,"x",1,"kom. x  (2d i 2k)"));
echo(str("vrata d mdf: ",(v-6)/10,"x",(sd-d-mdf-hdf-2)/10,"x",1,"kom. x  ((2d i 2k))"));
echo(str("pozadina l hdf: ",v/10,"x",sl/10,"x",1,"kom.")); 
echo(str("pozadina d hdf: ",v/10,"x",(sd-d+25)/10,"x",1,"kom."));  
rotate([0,0,90])translate([-sl,-d,0]) union(){
stranice=[m1,d,v];
desna_stranica=[d,m1,v];
siri_pod=[sl-2*m1,d,m1];
kraci_pod=[d,sd-d-m1,m1];
duze_polica=[sl-2*m1,d-30,m1];
krace_polica=[d-30,sd-d+30-m1,m1];
vrata_l=[sl-d-mdf-hdf-2,m1,v-6];
vrata_d=[m1,sd-d-mdf-hdf-2,v-6];
pozadina_l=[sl,3,v ];
pozadina_d=[hdf,sd-d+20,v ];
color(dezen_kutije){
//stranice
translate([sl-m1,0,0])
cube(stranice);
translate([0,0,0])
cube(stranice);
translate([sl-d, d-sd,0])
cube(desna_stranica);

//plafon i dno
translate([m1,0,0])
cube(siri_pod);
translate([m1,0,v-m1])
cube(siri_pod);
translate([sl-d,d-sd+m1,0])
cube(kraci_pod);
translate([sl-d,d-sd+m1,v-m1])
cube(kraci_pod);

            

//pozadina
if(pozadina){
translate([0,d,0])
   cube(pozadina_l);
translate([sl,-sd+d,0])
   cube(pozadina_d);   
}
// polica 
    
if(polica)
    {
      pomeriti = (v - m1) / (brp+1);
        echo(pomeriti)
      for (i = [1 : brp])
          {
            translate([m1,30,+i * pomeriti])  
            cube(duze_polica);
            translate([sl-m1-d+30 ,-sd+d+m1,+i * pomeriti])  
            cube(krace_polica);   
              
              
   }           
              
          }
    }     

// Vrata
if(front_vrata)
{
color(dezen_front1){
translate([1.5,-m1,3])
    cube(vrata_l);
translate([sl-d-mdf-hdf,-sd+d+1.5,3])
    cube(vrata_d);
    }
}
  }  }
*gue90rotiran(600,900,800,350,2);  
module lijevi_gue90(sl,sd,v,d,brp){

echo(str("stranice : ",v/10,"x",d/10,"x",3,"kom.((1d i 2k))- iverica 18mm"));
echo(str("siri_pod_i_plafon: ",(sl-2*m1)/10,"x",d/10,"x",2,"kom.(1d) - iverica 18mm"));
echo(str("uzi_pod_i_plafon: ",(sd-d-m1)/10,"x",d/10,"x",2,"kom.(1d i 1k) - iverica 18mm"));
echo(str("polica duze: ",(sl-2*m1)/10,"x",(d-30)/10,"x",brp,"kom. x (1d i 1k) - iverica 18mm"));
echo(str("polica krace: ",(sd-d+30-m1)/10,"x",(d-30)/10,"x",brp,"kom. x (1d i 1k) - iverica 18mm"));
echo(str("vrata l : ",(v-6)/10,"x",(sl-d-mdf-hdf-2)/10,"x",1,"kom. x  ((2d i 2k)) - mdf"));
echo(str("vrata d : ",(v-6)/10,"x",(sd-d-mdf-hdf-2)/10,"x",1,"kom. x  ((2d i 2k)) - mdf"));
echo(str("pozadina l hdf: ",v/10,"x",sl/10,"x",1,"kom.")); 
echo(str("pozadina d hdf: ",v/10,"x",(sd-d+25)/10,"x",1,"kom.")); 

lijeva_stranica=[m1,d,v];
stranice=[d,m1,v];
siri_pod=[d,sl-2*m1,m1];
kraci_pod=[sd-d-m1,d,m1];
duze_polica=[d-30,sl-2*m1,m1];
krace_polica=[sd-d+30-m1,d-30,m1];
vrata_l=[sd-d-mdf-hdf-2,mdf,v-6];
vrata_d=[mdf,sl-d-mdf-hdf-2,v-6];
pozadina_l=[hdf,sl,v ];
pozadina_d=[sd-d+20,hdf,v ];
color(dezen_kutije){
//stranice
translate([sd-d,-m1,0])
cube(stranice);
translate([sd-d,-sl,0])
cube(stranice);
translate([0, -d,0])
cube(lijeva_stranica);

//plafon i dno
translate([sd-d,-sl+m1,0])
cube(siri_pod);
translate([sd-d,-sl+m1,v-m1])
cube(siri_pod);
translate([m1,-d,0])
cube(kraci_pod);
translate([m1,-d,v-m1])
cube(kraci_pod);

            

//pozadina
if(pozadina){
translate([sd,-sl,0])
   cube(pozadina_l);
translate([0,0,0])
   cube(pozadina_d);   
}
// polica 
    
if(polica)
    {
      pomeriti = (v - m1) / (brp+1);
        echo(pomeriti)
      for (i = [1 : brp])
          {
            translate([sd-d+30,-sl+m1,+i * pomeriti])  
            cube(duze_polica);
            translate([m1 ,-d+30,+i * pomeriti])  
            cube(krace_polica);   
              
              
   }           
              
          }
    }     

// Vrata
if(front_vrata)
{
color(dezen_front){
translate([1.5,-d-mdf,3])
    cube(vrata_l);
translate([sd-d-mdf,-sl+1.5,3])
    cube(vrata_d);
    }
}
  }  
*lijevi_gue90(700,1000,800,350,2);      

//visoki kuhinjski elementi

module visoki_element_za_kombinovani_frizider(s,v,vde,d,c,brp,brv,frizider){
stranica=[m1,d,v-c-3*m1]; echo(str("stranica m1:",(v-c-3*m1)/10,"x",d/10,"x1kom.(1d i 2k)")); 
police_vezne=[s-2*m1,d-30,m1]; echo(str("police vezne m1:",(s-2*m1)/10,"x",(d-30)/10,"x2kom.(1d i 2k)")); 
dno=[s,d,m1];echo(str("dno m1:",s/10,"x",d/10,"x 1kom.(1d i 2k)"));
police_pokretne=[s-2*m1,d-80,m1];echo(str("police m1:",(s-2*m1)/10,"x",(d-80)/10,"x",brp,"kom.(1d)"));    
vrata_gornja=[s/brv-3,m1,(v-frizider-13-c)-3*m1-3];echo(str("vrata gornja mdf:",((v-frizider-13-c)-3*m1-3)/10,"x",(s/brv-3)/10,"x1kom.(2d i 2k)")); 
vrata_srednja=[s-3,m1,(v-vde)-(v-frizider-13-c-m1)-3];echo(str("vrata srednja mdf:",((v-vde)-(v-frizider-13-c-m1)-3)/10,"x",(s-3)/10,"x1kom.(2d i 2k)")); 
vrata_donja=[s-3,m1,vde-c-3];echo(str("vrata donja mdf:",(vde-c-3)/10,"x",(s-3)/10,"x1kom.(2d i 2k)"));    
lesonit=[s-m1,hdf,(v-frizider-c-13)-3*m1];echo(str("lesonit hdf:",(s-m1)/10,"x",((v-frizider-c-13)-3*m1)/10,"x 1kom."));    

//stranice
color(dezen_kutije){
translate([0,0,c+m1])
   cube(stranica);
translate([s-m1,0,c+m1])
   cube(stranica);
//police
translate([m1,0,frizider+10+c+m1])
   cube(police_vezne);
translate([m1,0,v-3*m1])
   cube(police_vezne); 
translate([0,0,c])
   cube(dno);}
//vrata
color(dezen_front){
if(front_vrata) 
{
    pom1eriti=s/brv;
    for(i=[0:brv-1])
    {
 translate([1.5+i*pom1eriti,-m1,frizider+10+c+m1+3])
   cube(vrata_gornja);
        
 translate([1.5,-m1,c])
   cube(vrata_donja); 
 translate([1.5,-m1,vde])
   cube(vrata_srednja);   
    
  }  
        
    }
}
//granc
*union(){
color(dezen_granc){
 translate([0,-m1,v-2*m1])
   cube([s,70,m1]);
translate([0,-m1,v-m1])
   cube([s,30,m1]);
 translate([0,-m1+70,v-2*m1])
   cube([70,d-70+m1,m1]);
translate([0,-m1+30,v-m1])
   cube([30,d-30+m1,m1]);
 translate([s-70,-m1+70,v-2*m1])
   cube([70,d-70+m1,m1]);
translate([s-30,-m1+30,v-m1])
   cube([30,d-30+m1,m1]);
}}
//lesonit
if(pozadina){
color(dezen_kutije){translate([m1/2,d-30,frizider+10+c+m1])
   cube(lesonit);
//police
if(polica) 
{
    pom1eriti=(v-2*m1-frizider-10-c)/(brp+1);
    for(i=[1:brp])
    {
 translate([m1,80-33,frizider+10+c+i*pom1eriti])       
   cube(police_pokretne);       
 }  } }
}
}
*visoki_element_za_kombinovani_frizider(600,2500,880,600,c,2,1,1800);
module visoki_element_za_kombinovani_frizider_gola(s,v,vde,d,c,brp,brv,frizider){
stranica=[m1,d,v-c-3*m1]; echo(str("stranica m1:",(v-c-3*m1)/10,"x",d/10,"x1kom.(1d i 2k)")); 
stranica_sa_rukohvatom=[m1,d-22,v-c-3*m1];echo(str("stranica sa rukohvatom m1:",(v-c-3*m1)/10,"x",(d-22)/10,"x1kom.(1d i 2k)")); 
police_vezne=[s-2*m1,d-30,m1]; echo(str("police vezne m1:",(s-2*m1)/10,"x",(d-30)/10,"x2kom.(1d i 2k)")); 
dno=[s,d,m1];echo(str("dno m1:",s/10,"x",d/10,"x 1kom.(1d i 2k)"));
police_pokretne=[s-2*m1,d-80,m1];echo(str("police m1:",(s-2*m1)/10,"x",(d-80)/10,"x",brp,"kom.(1d)"));    
vrata_gornja=[s/brv-3,m1,(v-frizider-13-c)-3*m1-3];echo(str("vrata gornja mdf:",((v-frizider-13-c)-3*m1-3)/10,"x",(s/brv-3)/10,"x1kom.(2d i 2k)")); 
vrata_srednja=[s-3,m1,(v-vde)-(v-frizider-13-c-m1)-3];echo(str("vrata srednja mdf:",((v-vde)-(v-frizider-13-c-m1)-3)/10,"x",(s-3)/10,"x1kom.(2d i 2k)")); 
vrata_donja=[s-3,m1,vde-c-3];echo(str("vrata donja mdf:",(vde-c-3)/10,"x",(s-3)/10,"x1kom.(2d i 2k)"));    
lesonit=[s-m1,hdf,(v-frizider-c-13)-3*m1];echo(str("lesonit hdf:",(s-m1)/10,"x",((v-frizider-c-13)-3*m1)/10,"x 1kom."));    

//stranice
color(dezen_kutije){
translate([0,-d+22,c+m1])
   cube(stranica_sa_rukohvatom);
translate([s-m1,-d,c+m1])
   cube(stranica);
//police
translate([m1,-d,frizider+10+c+m1])
   cube(police_vezne);
translate([m1,-d,v-3*m1])
   cube(police_vezne); 
translate([0,-d,c])
   cube(dno);}
//vrata
if(front_vrata) {
color(dezen_front){
    pom1eriti=s/brv;
    for(i=[0:brv-1])
    {
 translate([1.5+i*pom1eriti,-d-m1,frizider+10+c+m1+3])
   cube(vrata_gornja);
        
 translate([1.5,-d-m1,c])
   cube(vrata_donja); 
 translate([1.5,-d-m1,vde])
   cube(vrata_srednja);   
    
    
        
    }
}}
//granc
union();translate([0,-d,0]){
color(dezen_granc){
 translate([0,-m1,v-2*m1])
   cube([s,70,m1]);
translate([0,-m1,v-m1])
   cube([s,30,m1]);
 translate([0,-m1+70,v-2*m1])
   cube([70,d-70+m1,m1]);
translate([0,-m1+30,v-m1])
   cube([30,d-30+m1,m1]);
 translate([s-70,-m1+70,v-2*m1])
   cube([70,d-70+m1,m1]);
translate([s-30,-m1+30,v-m1])
   cube([30,d-30+m1,m1]);
}
}

//lesonit
if(pozadina){
color(dezen_kutije)
translate([m1/2,-30,frizider+10+c+m1])
   cube(lesonit);}
//police
if(polica) 
{
    pom1eriti=(v-2*m1-frizider-10-c)/(brp+1);
    for(i=[1:brp])
    {
 color(dezen_kutije)
 translate([m1,-d+80-33,frizider+10+c+i*pom1eriti])       
   cube(police_pokretne);       
    }
}
}
*visoki_element_za_kombinovani_frizider_gola(600,2500,880,600,c,2,1,1800);
module visoki_element_za_frizider(s,v,vde,d,c,brp,brv,frizider){
stranica=[m1,d,v-c-3*m1]; echo(str("stranica m1:",(v-c-3*m1)/10,"x",d/10,"x1kom.(1d i 2k)")); 
police_vezne=[s-2*m1,d-30,m1]; echo(str("police vezne m1:",(s-2*m1)/10,"x",(d-30)/10,"x2kom.(1d i 2k)")); 
dno=[s,d,m1];echo(str("dno m1:",s/10,"x",d/10,"x 1kom.(1d i 2k)"));
police_pokretne=[s-2*m1,d-80,m1];echo(str("police m1:",(s-2*m1)/10,"x",(d-80)/10,"x",brp,"kom.(1d)"));    
vrata_gornja=[s/brv-3,m1,(v-frizider-13-c)-3*m1-3];echo(str("vrata gornja mdf:",((v-frizider-13-c)-3*m1-3)/10,"x",(s/brv-3)/10,"x1kom.(2d i 2k)")); 
vrata_donja=[s-3,m1,v-2*m1+9-(v-frizider-13-c)-3*m1-3];echo(str("vrata donja mdf:",(vde-c-3)/10,"x",(s-3)/10,"x1kom.(2d i 2k)"));    
lesonit=[s-m1,hdf,(v-frizider-c-13)-3*m1];echo(str("lesonit hdf:",(s-m1)/10,"x",((v-frizider-c-13)-3*m1)/10,"x 1kom."));    

//stranice
color(dezen_kutije){
translate([0,0,c+m1])
   cube(stranica);
translate([s-m1,0,c+m1])
   cube(stranica);
//police
translate([m1,0,frizider+10+c+m1])
   cube(police_vezne);
translate([m1,0,v-3*m1])
   cube(police_vezne); 
translate([0,0,c])
   cube(dno);}
//vrata
if(front_vrata) {
color(dezen_front){
    pom1eriti=s/brv;
    for(i=[0:brv-1])
    {
 translate([1.5+i*pom1eriti,-m1,frizider+10+c+m1+3])
   cube(vrata_gornja);
        
 translate([1.5,-m1,c])
   cube(vrata_donja);   
    
        
    }
}}
//granc
color(dezen_granc){
 translate([0,-m1,v-2*m1])
   cube([s,70,m1]);
translate([0,-m1,v-m1])
   cube([s,30,m1]);
 translate([0,-m1+70,v-2*m1])
   cube([70,d-70+m1,m1]);
translate([0,-m1+30,v-m1])
   cube([30,d-30+m1,m1]);
 translate([s-70,-m1+70,v-2*m1])
   cube([70,d-70+m1,m1]);
translate([s-30,-m1+30,v-m1])
   cube([30,d-30+m1,m1]);
}
//lesonit
if(pozadina){
color(dezen_kutije)
translate([m1/2,d-30,frizider+10+c+m1])
   cube(lesonit);}
//police
if(polica) 
{
    pomeriti=(v-2*m1-frizider-10-c)/(brp+1);
    for(i=[1:brp])
    {
    color(dezen_kutije)
 translate([m1,80-33,frizider+10+c+i*pomeriti])       
   cube(police_pokretne);       
    }
}
    // 1. COKLA I NOGARI
    cokla(s, d, c, mdf, dezen_front);
}
*visoki_element_za_frizider(600,2500,880,600,c,2,1,1800);
module visoki_element_za_frizider_gola(s,v,vde,d,c,brp,brv,frizider){
stranica=[m1,d,v-c-3*m1]; echo(str("stranica m1:",(v-c-3*m1)/10,"x",d/10,"x1kom.(1d i 2k)"));
stranica_uska=[m1,d-22,v-c-3*m1]; echo(str("stranica m1:",(v-c-3*m1)/10,"x",(d-22)/10,"x1kom.(1d i 2k)")); 
police_vezne=[s-2*m1,d-30,m1]; echo(str("police vezne m1:",(s-2*m1)/10,"x",(d-30)/10,"x2kom.(1d i 2k)")); 
dno=[s,d,m1];echo(str("dno m1:",s/10,"x",d/10,"x 1kom.(1d i 2k)"));
police_pokretne=[s-2*m1,d-80,m1];echo(str("police m1:",(s-2*m1)/10,"x",(d-80)/10,"x",brp,"kom.(1d)"));    
vrata_gornja=[s/brv-3,m1,(v-frizider-13-c)-3*m1-3];echo(str("vrata gornja mdf:",((v-frizider-13-c)-3*m1-3)/10,"x",(s/brv-3)/10,"x1kom.(2d i 2k)")); 
vrata_donja=[s-3,m1,v-2*m1+9-(v-frizider-13-c)-3*m1-3];echo(str("vrata donja mdf:",(vde-c-3)/10,"x",(s-3)/10,"x1kom.(2d i 2k)"));    
lesonit=[s-m1,hdf,(v-frizider-c-13)-3*m1];echo(str("lesonit hdf:",(s-m1)/10,"x",((v-frizider-c-13)-3*m1)/10,"x 1kom."));    

//stranice
color(dezen_kutije){
translate([0,0,c+m1])
   cube(stranica);
translate([s-m1,22,c+m1])
   cube(stranica_uska);
//police
translate([m1,0,frizider+10+c+m1])
   cube(police_vezne);
translate([m1,0,v-3*m1])
   cube(police_vezne); 
translate([0,0,c])
   cube(dno);}
//vrata
if(front_vrata) {
color(dezen_front){
    pom1eriti=s/brv;
    for(i=[0:brv-1])
    {
 translate([1.5+i*pom1eriti,-m1,frizider+10+c+m1+3])
   cube(vrata_gornja);
        
 translate([1.5,-m1,c])
   cube(vrata_donja);   
    
        
    }}
}
//granc
color(dezen_granc){
 translate([0,-m1,v-2*m1])
   cube([s,70,m1]);
translate([0,-m1,v-m1])
   cube([s,30,m1]);
 translate([0,-m1+70,v-2*m1])
   cube([70,d-70+m1,m1]);
translate([0,-m1+30,v-m1])
   cube([30,d-30+m1,m1]);
 translate([s-70,-m1+70,v-2*m1])
   cube([70,d-70+m1,m1]);
translate([s-30,-m1+30,v-m1])
   cube([30,d-30+m1,m1]);
}
//lesonit
if(pozadina){
color(dezen_kutije)translate([m1/2,d-30,frizider+10+c+m1])
   cube(lesonit);}
//police
if(polica) 
{
    pom1eriti=(v-2*m1-frizider-10-c)/(brp+1);
    for(i=[1:brp])
    {
 color(dezen_kutije)
 translate([m1,80-33,frizider+10+c+i*pom1eriti])       
   cube(police_pokretne);       
    }
}
}
*visoki_element_za_frizider_gola(600,2500,880,600,c,2,1,1800);
module visoki_element_za_rernu(s,v,vde,d,c,brp,brv,rerna){
stranica=[m1,d,v-c-3*m1]; echo(str("stranica m1:",(v-c-3*m1)/10,"x",d/10,"x2kom.(1d i 2k)")); 
police_vezne=[s-2*m1,d-30,m1]; echo(str("police vezne m1:",(s-2*m1)/10,"x",(d-30)/10,"x4kom.(1k)")); 
dno=[s,d,m1];echo(str("dno m1:",s/10,"x",d/10,"x 1kom.(1d i 2k)"));
police_pokretne=[s-2*m1,d-80,m1];echo(str("police m1:",(s-2*m1)/10,"x",(d-80)/10,"x",brp+1,"kom.(1d)"));    
vrata_gornja=[s/brv-3,m1,v-vde-rerna-3*m1-3];echo(str("vrata gornja mdf:",(v-vde-rerna-3*m1-3)/10,"x",(s/brv-3)/10,"x1kom.(2d i 2k)")); 
vrata_donja=[s-3,m1,vde-c-3];echo(str("vrata donja mdf:",(vde-c-3)/10,"x",(s-3)/10,"x1kom.(2d i 2k)"));    
lesonit=[s-m1,hdf,vde-c+m1/2];echo(str("lesonit hdf:",(s-m1)/10,"x",(vde-c+m1/2)/10,"x 1kom."));
lesonit_gornji=[s-m1,hdf,v-vde-rerna-2*m1];echo(str("lesonit gornji hdf:",(s-m1)/10,"x",(v-vde-rerna-2*m1)/10,"x 1kom."));    

//stranice
color(dezen_kutije){
translate([0,0,c+m1])
   cube(stranica);
translate([s-m1,0,c+m1])
   cube(stranica);
//police
translate([m1,0,vde-m1])cube(police_vezne);
translate([m1,0,vde+rerna])cube(police_vezne);
translate([m1,0,v-3*m1])cube(police_vezne); 
translate([0,0,c])
   cube(dno);}
//vrata
if(front_vrata) {
color(dezen_front){
    pom1eriti=s/brv;
    for(i=[0:brv-1])
    {
 translate([1.5+i*pom1eriti,-m1,vde+rerna+m1])
   cube(vrata_gornja);
        
 translate([1.5,-m1,c])
   cube(vrata_donja); 
   
    
    
     }   
    }
}
//granc
color(dezen_granc){
 translate([0,-m1,v-2*m1])
   cube([s,70,m1]);
translate([0,-m1,v-m1])
   cube([s,30,m1]);
 translate([0,-m1+70,v-2*m1])
   cube([70,d-70+m1,m1]);
translate([0,-m1+30,v-m1])
   cube([30,d-30+m1,m1]);
 translate([s-70,-m1+70,v-2*m1])
   cube([70,d-70+m1,m1]);
translate([s-30,-m1+30,v-m1])
   cube([30,d-30+m1,m1]);
}
//lesonit
if(pozadina){
color(dezen_kutije){
translate([m1/2,d-30,c+m1/2])cube(lesonit);
translate([m1/2,d-30,vde+rerna])
   cube(lesonit_gornji);} } 
//police
if(polica) 
{
    pomeriti=(v-vde-rerna-2*m1)/(brp+1);
    for(i=[1:brp])
    {
    color(dezen_kutije)
 translate([m1,80-33,vde+m1+rerna+i*pomeriti])       
   cube(police_pokretne);       
    }
    color(dezen_kutije)
translate([m1,80-33,(vde+c)/2])cube(police_pokretne);     
}
    // 1. COKLA I NOGARI
    cokla(s, d, c, mdf, dezen_front);
}
*visoki_element_za_rernu(600,2500,880,600,100,2,1,585);
module visoki_element_za_rernu_sa_fiokama(s,v,vde,d,c,brp,brv,rerna){
stranica=[m1,d,v-c-3*m1]; echo(str("stranica m1:",(v-c-3*m1)/10,"x",d/10,"x2kom.(1d i 2k)")); 
police_vezne=[s-2*m1,d-30,m1]; echo(str("police vezne m1:",(s-2*m1)/10,"x",(d-30)/10,"x4kom.(1k)")); 
dno=[s,d,m1];echo(str("dno m1:",s/10,"x",d/10,"x 1kom.(1d i 2k)"));
police_pokretne=[s-2*m1,d-80,m1];echo(str("police m1:",(s-2*m1)/10,"x",(d-80)/10,"x",brp+1,"kom.(1d)"));    
vrata_gornja=[s/brv-3,m1,v-vde-rerna-3*m1-3];echo(str("vrata gornja mdf:",(v-vde-rerna-3*m1-3)/10,"x",(s/brv-3)/10,"x1kom.(2d i 2k)"));     
lesonit=[s-m1,hdf,vde-c+m1/2];echo(str("lesonit hdf:",(s-m1)/10,"x",(vde-c+m1/2)/10,"x 1kom."));
lesonit_gornji=[s-m1,hdf,v-vde-rerna-2*m1];echo(str("lesonit gornji hdf:",(s-m1)/10,"x",(v-vde-rerna-2*m1)/10,"x 1kom."));    

//stranice
color(dezen_kutije){
translate([0,0,c+m1])
   cube(stranica);
translate([s-m1,0,c+m1])
   cube(stranica);
//police
translate([m1,0,vde-m1])cube(police_vezne);
translate([m1,0,vde+rerna])cube(police_vezne);
translate([m1,0,v-3*m1])cube(police_vezne); 
translate([0,0,c])
   cube(dno);}
//vrata
if(front_vrata) {
color(dezen_front){
    pom1eriti=s/brv;
    for(i=[0:brv-1])
    {
 translate([1.5+i*pom1eriti,-m1,vde+rerna+m1])
   cube(vrata_gornja);
    }} }     


module fioke_duboke(v,brf,brfd,kl){
//celo_duboke_fioke
if(celafioka){
color(dezen_front){
 celo_duboke_fioke= [s-3,mdf,(v-c)/brf*2-3];
    echo(str("celo_duboke_fioke mdf:",((v-c)/brf*2-3)/10,"x",(s-3)/10,"x",brfd,"kom.(2d i 2k)"));  
pom=(v-c)/brf ;
  for(j=[0]){
translate([1.5,-mdf,c+j*pom])
cube(celo_duboke_fioke);} } 
}
//fioka_duboka
stranica_duboke_fioke=[m,kl-8,(v-c)/brf*2-58];

mstr_duboke_fioke=[s-2*m1-8-2*m,m1,(v-c)/brf*2-58-12-m1];
dno_fioka=[s-2*m1-8-2*m,kl-10,m1];
 if(fioke){
 pom=(v-c)/brf ;
  for(i=[0]){
color(dezen_kutije){  
translate([0,0,c+12+i*pom])union(){   
translate([m1+4,0,m1+4])
cube(stranica_duboke_fioke);
translate([s-m1-4-m,0,m1+4])
cube(stranica_duboke_fioke);
translate([m1+4+m,0,m1+4+12+m1])
cube(mstr_duboke_fioke);
translate([m1+4+m,kl-10-m1,m1+4+12+m1])
cube(mstr_duboke_fioke);
translate([m1+4+m,0,m1+4+12])
color([0,1,0])
cube(dno_fioka);
        }      }
}
 }      
}
fioke_duboke(vde,4,1,500);
module fioke_plitke(v,brf,brfp,kl){
//cela_plitkih_fioka
if(celafioka){
color(dezen_front){
 celo_plitke_fioke= [s-3,mdf,(v-c)/brf-3];
    echo(str("celo_plitke_fioke mdf:",((v-c)/brf-3)/10,"x",(s-3)/10,"x",brfp,"kom.(2d i 2k)"));  
pomeriti=(v-c)/brf ;
  for(k=[2:brf-1]){
translate([1.5,-mdf,c+k*pomeriti])
cube(celo_plitke_fioke);} } 
}
//fioka_plitka
stranica_plitke_fioke=[m,kl-8,(v-c)/brf-58];

mstr_plitke_fioke=[s-2*m1-8-2*m,m1,(v-c)/brf-58-12-m1];
dno_fioka=[s-2*m1-8-2*m,kl-10,m1];
 if(fioke){
 pom=(v-c)/brf ;
  for(i=[2:(brf-1)]){
  color(dezen_kutije){
translate([0,0,c+12+i*pom])union(){   
translate([m1+4,0,m1+4])
cube(stranica_plitke_fioke);
translate([s-m1-4-m,0,m1+4])
cube(stranica_plitke_fioke);
translate([m1+4+m,0,m1+4+12+m1])
cube(mstr_plitke_fioke);
translate([m1+4+m,kl-10-m1,m1+4+12+m1])
cube(mstr_plitke_fioke);
translate([m1+4+m,0,m1+4+12])
color([0,1,0])
cube(dno_fioka);
     }        }
}
 }      
}
fioke_plitke(vde,4,2,500);
//granc
*union(s){
color(dezen_granc){
 translate([0,-m1,v-2*m1])
   cube([s,70,m1]);
translate([0,-m1,v-m1])
   cube([s,30,m1]);
 translate([0,-m1+70,v-2*m1])
   cube([70,d-70+m1,m1]);
translate([0,-m1+30,v-m1])
   cube([30,d-30+m1,m1]);
 translate([s-70,-m1+70,v-2*m1])
   cube([70,d-70+m1,m1]);
translate([s-30,-m1+30,v-m1])
   cube([30,d-30+m1,m1]);
}}
//lesonit
if(pozadina){
color(dezen_kutije){
translate([m1/2,d-30,c+m1/2])cube(lesonit);
translate([m1/2,d-30,vde+rerna])
   cube(lesonit_gornji);  
//police
if(polica) 
{
    pomeriti=(v-vde-rerna-2*m1)/(brp+1);
    for(i=[1:brp])
    {
 translate([m1,80-33,vde+m1+rerna+i*pomeriti])       
   cube(police_pokretne);       
 }   }
 }    
}
    // 1. COKLA I NOGARI
    cokla(s, d, c, mdf, dezen_front);
}
*visoki_element_za_rernu_sa_fiokama(600,2500,880,600,100,2,1,585);   
module visoki_element_za_rernu_i_mikrotalasnu_pec_sa_fiokama(s,v,vde,d,c,brp,brv,rerna,mikrovele){
stranica=[m1,d,v-c-3*m1]; echo(str("stranica m1:",(v-c-3*m1)/10,"x",d/10,"x","2kom.(1d i 2k)")); 
police_vezne=[s-2*m1,d-30,m1]; echo(str("police vezne m1:",(s-2*m1)/10,"x",(d-30)/10,"x","4kom.(1k)")); 
dno=[s,d,m1];echo(str("dno m1:",s/10,"x",d/10,"x 1kom.(1d i 2k)"));
police_pokretne=[s-2*m1,d-80,m1];echo(str("police m1:",(s-2*m1)/10,"x",(d-80)/10,"x",brp+1,"kom.(1d)"));    
vrata_gornja=[s/brv-3,m1,v-vde-rerna-mikrovele-8-3*m1-3];echo(str("vrata gornja mdf:",(v-vde-rerna-3*m1-3)/10,"x",(s/brv-3)/10,"x1kom.(2d i 2k)")); 
vrata_donja=[s-3,m1,vde-c-3];echo(str("vrata donja mdf:",(vde-c-3)/10,"x",(s-3)/10,"x1kom.(2d i 2k)"));    
lesonit=[s-m1,hdf,vde-c+m1/2];echo(str("lesonit hdf:",(s-m1)/10,"x",(vde-c+m1/2)/10,"x 1kom."));
lesonit_gornji=[s-m1,hdf,v-vde-rerna-mikrovele-3*m1];echo(str("lesonit gornji hdf:",(s-m1)/10,"x",(v-vde-rerna-2*m1)/10,"x 1kom."));    

//stranice
color(dezen_kutije){
translate([0,-d,c+m1])
   cube(stranica);
translate([s-m1,-d,c+m1])
   cube(stranica);
//police
translate([m1,-d,vde-m1])cube(police_vezne);
translate([m1,-d,vde+rerna])cube(police_vezne);
translate([m1,-d,vde+rerna+m1+mikrovele])cube(police_vezne);
translate([m1,-d,v-3*m1])cube(police_vezne); 
translate([0,-d,c])
   cube(dno);}
//vrata
if(front_vrata) {
color(dezen_front){
    pom1eriti=s/brv;
    for(i=[0:brv-1])
    {
 translate([1.5+i*pom1eriti,-d-m1,vde+rerna+m1+mikrovele+8])
   cube(vrata_gornja);
    }} }     


module fioke_duboke(v,brf,brfd,kl){
//celo_duboke_fioke
if(celafioka){
color(dezen_front){
 celo_duboke_fioke= [s-3,mdf,(v-c)/brf*2-3];
    echo(str("celo_duboke_fioke mdf:",((v-c)/brf*2-3)/10,"x",(s-3)/10,"x",brfd,"kom.(2d i 2k)"));  
pom=(v-c)/brf ;
  for(j=[0]){
translate([1.5,-d-mdf,c+j*pom])
cube(celo_duboke_fioke);} } 
}
//fioka_duboka
stranica_duboke_fioke=[m,kl-8,(v-c)/brf*2-58];

mstr_duboke_fioke=[s-2*m1-8-2*m,m1,(v-c)/brf*2-58-12-m1];
dno_fioka=[s-2*m1-8-2*m,kl-10,m1];
 if(fioke){
 pom=(v-c)/brf ;
  for(i=[0]){
color(dezen_kutije){  
translate([0,-d,c+12+i*pom])union(){   
translate([m1+4,0,m1+4])
cube(stranica_duboke_fioke);
translate([s-m1-4-m,0,m1+4])
cube(stranica_duboke_fioke);
translate([m1+4+m,0,m1+4+12+m1])
cube(mstr_duboke_fioke);
translate([m1+4+m,kl-10-m1,m1+4+12+m1])
cube(mstr_duboke_fioke);
translate([m1+4+m,0,m1+4+12])
color([0,1,0])
cube(dno_fioka);
        }      }
}
 }      
}
fioke_duboke(vde,4,1,500);
module fioke_plitke(v,brf,brfp,kl){
//cela_plitkih_fioka
if(celafioka){
color(dezen_front){
 celo_plitke_fioke= [s-3,mdf,(v-c)/brf-3];
    echo(str("celo_plitke_fioke mdf:",((v-c)/brf-3)/10,"x",(s-3)/10,"x",brfp,"kom.(2d i 2k)"));  
pomeriti=(v-c)/brf ;
  for(k=[2:brf-1]){
translate([1.5,-d-mdf,c+k*pomeriti])
cube(celo_plitke_fioke);} } 
}
//fioka_plitka
stranica_plitke_fioke=[m,kl-8,(v-c)/brf-58];

mstr_plitke_fioke=[s-2*m1-8-2*m,m1,(v-c)/brf-58-12-m1];
dno_fioka=[s-2*m1-8-2*m,kl-10,m1];
 if(fioke){
 pom=(v-c)/brf ;
  for(i=[2:(brf-1)]){
  color(dezen_kutije){
translate([0,-d,c+12+i*pom])union(){   
translate([m1+4,0,m1+4])
cube(stranica_plitke_fioke);
translate([s-m1-4-m,0,m1+4])
cube(stranica_plitke_fioke);
translate([m1+4+m,0,m1+4+12+m1])
cube(mstr_plitke_fioke);
translate([m1+4+m,kl-10-m1,m1+4+12+m1])
cube(mstr_plitke_fioke);
translate([m1+4+m,0,m1+4+12])
color([0,1,0])
cube(dno_fioka);
     }        }
}
 }      
}
fioke_plitke(vde,4,2,500);
//granc
translate([0,-d,0])union(s){
color(dezen_granc){
 translate([0,-m1,v-2*m1])
   cube([s,70,m1]);
translate([0,-m1,v-m1])
   cube([s,30,m1]);
 translate([0,-m1+70,v-2*m1])
   cube([70,d-70+m1,m1]);
translate([0,-m1+30,v-m1])
   cube([30,d-30+m1,m1]);
 translate([s-70,-m1+70,v-2*m1])
   cube([70,d-70+m1,m1]);
translate([s-30,-m1+30,v-m1])
   cube([30,d-30+m1,m1]);
}}
//lesonit
if(pozadina){
color(dezen_kutije){
translate([m1/2,-30,c+m1/2])cube(lesonit);
translate([m1/2,-30,vde+rerna+m1+mikrovele])
   cube(lesonit_gornji);  
//police
if(polica) 
{
    pomeriti=(v-vde-rerna-mikrovele-2*m1)/(brp+1);
    for(i=[1:brp])
    {
 translate([m1,-d+80-33,vde+2*m1+rerna+mikrovele+i*pomeriti])       
   cube(police_pokretne);       
 }   }
 }    
}
}  
*visoki_element_za_rernu_i_mikrotalasnu_pec_sa_fiokama(600,2500,880,600,100,1,1,585,380); 

// --- GLOBALNI RASPORED ---

// 1. LEVI ZID (Lijevi krak)
*translate([0, 0, 0]) 
    rotate([0,0,90]) // Rotacija uz lijevi zid
    gola_radni_stol(700, 880, 550, c, 1, 2);

// 2. UGAO 1 (Lijevi-Čeoni)
*translate([0, 0, 0])
    donji_ugaoni_element_45_sa_plocom_gola(900, 900, 880, 550, c);

// 3. ČEONI ZID (Centralni dio - npr. sudopera i rerna)
*translate([900, 0, 0])
    vrata_sudo_masine_gola(600, 880, 550, c);

*translate([1500, 0, 0])
    radni_stol_rerne_gola(600, 880, 550, c, 585);

// 4. UGAO 2 (Čeoni-Desni)
*translate([2220, 0, 0])
    rotate([0,0,0])
    donji_ugaoni_element_45_sa_plocom_gola(900, 900, 880, 550, c);

// 5. DESNI ZID (Desni krak - npr. tvoj fiokar)
*translate([2220, -900, 0])
    rotate([0,0,-90])
    fiokar_gola(700, 880, 550, c, 4, 2, 1);

