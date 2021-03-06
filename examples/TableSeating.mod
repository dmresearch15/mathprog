# Example: TableSeating.mod

/* 
Be careful. The computational effort required for this prolbem grows
quickly with N and TABLE_SIZE. Until html 5 worker threads are implemented,
this may lock up your browser during the lengthy solution.
*/

param N_TABLES := 4;
param TABLE_SIZE := 3;

set TABLES := 1..N_TABLES;
set PEOPLE := 1..TABLE_SIZE*N_TABLES;
set PAIRS := {p in PEOPLE, q in PEOPLE : q > p};

var x{PEOPLE,TABLES} binary;
var y{PAIRS} binary;

/* Assignment Constraints */
s.t. TablesAreFull{t in TABLES}: sum{p in PEOPLE} x[p,t] = 3;
s.t. SOS {p in PEOPLE}: sum{t in TABLES} x[p,t] = 1;

/* Who is sitting with whom */
s.t. W1 {t in TABLES, (p,q) in PAIRS}: y[p,q] >= x[p,t] + x[q,t] - 1;
s.t. W2 {p in PEOPLE}: 
    (sum{q in 1..(p-1)} y[q,p]) + (sum{q in (p+1)..card(PEOPLE)} y[p,q])
    = TABLE_SIZE - 1;

maximize obj: sum{(p,q) in PAIRS} y[p,q];

solve;

printf "Table Assignments\n";
printf "          ";
printf {p in PEOPLE}: "  %2d", p;
printf "\n";
for {t in TABLES}: {
    printf "Table(%d): ", t;
    printf {p in PEOPLE}: "   %d", x[p,t];
    printf "\n";
}

printf "\nPairings\n";
for {t in TABLES} : {
    printf "Table %d : ",t;
    printf {(p,q) in PAIRS : y[p,q] = 1 && x[p,t] = 1}: " (%2d,%2d) ",p,q;
    printf "\n";
}

end;