module ploca_za_kuvanje(x,y,z){
plotna=[x,y,z];
color("black")translate([10,15,880+38])cube(plotna);

}
*ploca_za_kuvanje(580,510,5);

module sudopera(D,h){
color("LightSteelBlue")
    translate([0, 30,-h])
        rotate_extrude($fn = 80)
            polygon( points=[[30,0],[200,0],[200,h],[D/2,h],[D/2-3,h+3],[197,h+3],[197,3],[30,3]] );

}
*sudopera(480,180);
module otvor_sudopere(D,h){
cylinder(h,d=D,center=true);

}
*otvor_sudopere(450,40);

module cevasta_rucka_horizontala(duzina,visina,debljina){
rotate([90,0,0,])
union(){
translate([-duzina/2+visina-debljina/2,0,0])cylinder(visina,debljina,debljina);
translate([duzina/2-visina-debljina/2,0,0])cylinder(visina,debljina,debljina);
rotate([0,90,0])translate([-visina-1,0,0])cylinder(duzina,debljina,debljina,center=true);
}
}
*cevasta_rucka_horizontala(186,25,8);

module cevasta_rucka(duzina,visina,debljina){
rotate([90,-90,0])
union(){
translate([-duzina/2+visina-debljina/2,0,0])cylinder(visina,debljina,debljina);
translate([duzina/2-visina-debljina/2,0,0])cylinder(visina,debljina,debljina);
rotate([0,90,0])translate([-visina-1,0,0])cylinder(duzina,debljina,debljina,center=true);
}
}
*cevasta_rucka(186,25,8);