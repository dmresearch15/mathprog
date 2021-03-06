/* main.js loads at end of mathprog.html */

/* fix browser compatability issues */

// for IE8 compatability with trim() per http://stackoverflow.com/questions/2308134/
if(typeof String.prototype.trim !== 'function') {
  String.prototype.trim = function() {
    return this.replace(/^\s+|\s+$/g, ''); 
  }
}

// for iOS compatability with nav menus
$('body').on('touchstart.dropdown', '.dropdown-menu', function (e) { e.stopPropagation(); });

// Global Variables
var fileSep = "/";
var exampleDir = "./examples";
var descriptionDir = "./descriptions";
var homeURL = 'https://www3.nd.edu/~jeff/mathprog/mathprog.html';
var fileId = new Array();
var fileCount = 0;
var ds = new Array();

var glpColKind = new Array();
glpColKind[GLP_CV] = 'Real';
glpColKind[GLP_IV] = 'Integer';
glpColKind[GLP_BV] = 'Binary';

var glpColStatus = new Array();
glpColStatus[GLP_BS] = 'Basic';
glpColStatus[GLP_NL] = 'LoBnd';
glpColStatus[GLP_NU] = 'UpBnd';
glpColStatus[GLP_NF] = 'Free';
glpColStatus[GLP_NS] = 'Fixed';

var glpRowStatus = new Array();
glpRowStatus[GLP_BS] = 'Basic';
glpRowStatus[GLP_NL] = 'LoBnd';
glpRowStatus[GLP_NU] = 'UpBnd';
glpRowStatus[GLP_NF] = 'Free';
glpRowStatus[GLP_NS] = 'Fixed';

var glpStatus = new Array();
glpStatus[GLP_OPT]    = "Solution is optimal.";
glpStatus[GLP_FEAS]   = "Solution is feasible.";
glpStatus[GLP_INFEAS] = "Solution is infeasible.";
glpStatus[GLP_NOFEAS] = "Problem has no feasible solution.";
glpStatus[GLP_UNBND]  = "Problem has unbounded solution.";
glpStatus[GLP_UNDEF]  = "Solution is undefined.";

// global glpk data structure
var lp = glp_create_prob();
glp_set_print_func(printLog);

// modal callback function
var modalCallback = function() {};

// variable to save name of fil
var saveAnchor = document.getElementById('saveAnchor');

// attach CodeMirror to the textarea 'editor'
var modelEditor = CodeMirror.fromTextArea(document.getElementById("editor"), {
    lineNumbers: true,
    lineWrapping: true,
    mode: 'mathprog'
});
modelEditor.markClean();

// other initializations

google.load('visualization', '1.0', { packages:['controls'] });

$('#modalAbout').modal({show:false});
$('#modalSave').modal({show:false});
$('#modalSaveAlert').modal({show:false});

$('#btnClearAll').tooltip();
$('#btnOpenModel').tooltip();
$('#btnSaveModel').tooltip();
$('#btnCreateLink').tooltip();

$('#btnClearAll').click(clearAll);
$('#btnOpenModel').click(openModel);
$('#btnSaveModel').click(saveModel);
$('#btnCreateLink').click(createLink);
$('#btnSolve').click(solve);

$('#btnSolveMIP').click();

/**********************************************************************
 load example
**********************************************************************/

function loadDescription(filename) {
    filename = filename || '';
    if (filename) {
        $.get(descriptionDir + fileSep + filename, function(data) {
            $('#instructionContent').html(data);
            MathJax.Hub.Queue(["Typeset",MathJax.Hub,document.getElementById('instructionContent')]);
        });
    }
}

function loadEx(descriptionFile,modelFile) {
    if (modelEditor.isClean()) {
        loadModel(modelFile);
        loadDescription(descriptionFile);
    } else {
        modalCallback = function() {
            modelEditor.markClean();
            loadEx(descriptionFile,modelFile);
        }
        $('#modalConfirmClearAll').modal({show: true});
    }
}

// load model file into editor
function loadModel(filename) {
    filename = filename || '';
    if (filename) {
        if (modelEditor.isClean()) {
           $.get(exampleDir + fileSep + filename, function(data) {
                modelEditor.setValue(data);
                modelEditor.markClean();
                $('#modelFileName').html(filename);
                clearOutput();
            })
        } else {
            modalCallback = function() {
               modelEditor.markClean();
               loadModel(filename);
            }
            $('#modalConfirmClearAll').modal({show: true});
        }
    }
}

/**********************************************************************
 utility functions
**********************************************************************/

// round number to a specified significant digits
function formatNumber(num,sig){
    if (isNaN(parseFloat(num)) || !isFinite(num)) {return num;}
    if (Math.abs(num) <= Number.MIN_VALUE) {return '0';}
    if (num >= Number.MAX_VALUE/10) {return '+Inf';}
    if (num <= -Number.MAX_VALUE/10) {return '-Inf';}
    if (arguments.length < 2) {sig = 5;}
    if (num.toPrecision(sig) == num) {return num.toString();}
    return num.toPrecision(sig).toString();
}

/**********************************************************************
 variables pane
**********************************************************************/

function writeVariableTable() {
    variableData = new google.visualization.DataTable();
    variableData.addColumn({type:'string', label:'Name'});
    variableData.addColumn({type:'string', label:'Kind'});
    variableData.addColumn({type:'string', label:'Status'});
    variableData.addColumn({type:'number', label:'LoBnd'});
    variableData.addColumn({type:'number', label:'UpBnd'});
    variableData.addColumn({type:'number', label:'Relaxed'});
    variableData.addColumn({type:'number', label:'Sensitivity'});
    variableData.addColumn({type:'number', label:'Solution'});

    var soln = 0;
    for (var i = 1; i <= glp_get_num_cols(lp); i++) {
        soln = isMIP()?glp_mip_col_val(lp,i):glp_get_col_prim(lp,i);
        variableData.addRow([
            glp_get_col_name(lp,i),
            glpColKind[glp_get_col_kind(lp,i)], 
            glpColStatus[glp_get_col_stat(lp,i)],
            { v: glp_get_col_lb(lp,i), f: formatNumber(glp_get_col_lb(lp,i)) },
            { v: glp_get_col_ub(lp,i), f: formatNumber(glp_get_col_ub(lp,i)) },
            { v: glp_get_col_prim(lp,i), f: formatNumber(glp_get_col_prim(lp,i)) },
            { v: glp_get_col_dual(lp,i), f: formatNumber(glp_get_col_dual(lp,i)) },
            { v: soln, f: formatNumber(soln) }
        ]);
    }

    variableFilter = new google.visualization.ControlWrapper({
        'controlType': 'StringFilter',
        'containerId': 'variableFilterDiv',
        'options': {'filterColumnLabel': 'Name'}
    });

    variableTable = new google.visualization.ChartWrapper({
        'chartType': 'Table',
        'containerId': 'variableTableDiv'
    })

    variableDashboard = new google.visualization.Dashboard(document.getElementById('variableTab'));
    variableDashboard.bind(variableFilter,variableTable);
    variableDashboard.draw(variableData,{width: '750px'});
}

/**********************************************************************
 constraints pane
**********************************************************************/

function writeConstraintTable() {
    constraintData = new google.visualization.DataTable();
    constraintData.addColumn({type:'string', label:'Name'});
    constraintData.addColumn({type:'string', label:'Status'});
    constraintData.addColumn({type:'number', label:'LB'});
    constraintData.addColumn({type:'number', label:'UB'});
    constraintData.addColumn({type:'number', label:'Relax LP'});
    constraintData.addColumn({type:'number', label:'Sensitivity'});
    constraintData.addColumn({type:'number', label:'Solution'});

    var soln = 0;
    for (var i = 1; i <= glp_get_num_rows(lp); i++) {
        soln = isMIP()?glp_mip_row_val(lp,i):glp_get_row_prim(lp,i);
        constraintData.addRow([
            glp_get_row_name(lp,i),
            glpRowStatus[glp_get_row_stat(lp,i)],
            { v: glp_get_row_lb(lp,i), f: formatNumber(glp_get_row_lb(lp,i)) },
            { v: glp_get_row_ub(lp,i), f: formatNumber(glp_get_row_ub(lp,i)) },
            { v: glp_get_row_prim(lp,i), f: formatNumber(glp_get_row_prim(lp,i)) },
            { v: glp_get_row_dual(lp,i), f: formatNumber(glp_get_row_dual(lp,i)) },
            { v: soln, f: formatNumber(soln) }
        ]);
    }

    constraintFilter = new google.visualization.ControlWrapper({
        'controlType': 'StringFilter',
        'containerId': 'constraintFilterDiv',
        'options': {'filterColumnLabel': 'Name'}
    });

    constraintTable = new google.visualization.ChartWrapper({
        'chartType': 'Table',
        'containerId': 'constraintTableDiv',
        'options': {
            width: 750
        }
    })

    constraintDashboard = new google.visualization.Dashboard(document.getElementById('constraintTab'));
    constraintDashboard.bind(constraintFilter,constraintTable);
    constraintDashboard.draw(constraintData,{width: 750});
}

/**********************************************************************
 functions to manage the display message
**********************************************************************/

function displayInfo (value) {
    clearMessage();
    $('#message').addClass('alert-info').html(value).css('visibility','visible').show();
}

function displaySuccess (value) {
    clearMessage();
    $('#message').addClass('alert-success').html(value).css('visibility','visible').show();
}

function displayWarning (value) {
    clearMessage();
    $('#message').addClass('alert-warning').html(value).css('visibility','visible').show();
}

function displayError (value) {
    clearMessage();
    $('#message').addClass('alert-error').html(value).css('visibility','visible').show();
}

function clearMessage() {
    $('#message').removeClass('alert-success');
    $('#message').removeClass('alert-warning');
    $('#message').removeClass('alert-error');
    $('#message').removeClass('alert-info');
    $('#message').css('visibility','hidden');
}

/**********************************************************************
 manage dashboard pane
**********************************************************************/

function displayDashboard() {
    var nBV = glp_get_num_bin(lp);
    var nIV = glp_get_num_int(lp) - nBV;
    var nCV = glp_get_num_cols(lp) - nIV - nBV;
    var nVars = nCV + nIV + nBV;

    var nCols = glp_get_num_cols(lp);
    var nInt = glp_get_num_int(lp);
    var nBin = glp_get_num_bin(lp);
    var nRows = glp_get_num_rows(lp);
    var problemType = '';
    var problemType =  glp_get_obj_name(lp)?'Optimization':'Feasibility';
    if (nVars == 0) {
        problemType = 'Empty';
    } else if (nBV + nIV == 0) {
        problemType = 'Linear ' + problemType;
    } else if (nCV + nIV == 0) {
        problemType = '0-1 ' + problemType;
    } else if (nCV == 0) {
        problemType = 'Integer ' + problemType;
    } else if (nIV == 0) {
        problemType = 'Mixed 0-1 ' + problemType;
    } else {
        problemType = 'Mixed Integer ' + problemType;
    }
    $('#dashboardProb').html(problemType);
    if (glp_get_obj_name(lp)) {
        $('#dashboardObj').html((glp_get_obj_dir(lp)==GLP_MIN?'Minimum ':'Maximum ') + glp_get_obj_name(lp));
    } else {
        $('#dashboardObj').html('null');
    }
    $('#dashboardObjVal').html(formatNumber(isMIP()?glp_mip_obj_val(lp):glp_get_obj_val(lp),8));
    $('#dashboardNcols').html(nVars);
    $('#dashboardNints').html(nIV);
    $('#dashboardNbins').html(nBV);
    $('#dashboardNvars').html(nCV);
    $('#dashboardNrows').html(nRows);
    $('#dashboardNnz').html(glp_get_num_nz(lp));
}

function clearDashboard (){
    $('.dashboardCell').html('');
}
$('.dashboardCell').css('text-align','right');

function getURLParameter(name) {
    return decodeURIComponent(
            (new RegExp('[?|&]' + name + '=' + 
                '([^&;]+?)(&|#|;|$)').exec(location.search)||[,""])[1].replace(/\+/g, '%20'))||null;
}

// open menu links w/ rel="external" in new windows to avoid losing edits
$('a[rel="external"]').click(function() {
    $(this).attr('target','_blank');
})

// menu item Home
$('#menuHome').click(function () {
    loadEx('welcome.html','untitled.mod');
    $('#solveMIP').click();
})

// menu item About... 
$('#menuAbout').click(function () {
    $('#modalAbout').modal({show:true});
})

function clearAll() {
    if (modelEditor.isClean()) {
        loadEx('_blank.html','untitled.mod');
        clearData();
    } else {
        modalCallback = function () {
            modelEditor.markClean();
            clearAll();
        };
        $('#modalConfirmClearAll').modal({show: true});
    }
}

function clearOutput() {
    clearMessage();
    clearDashboard();
    $('#variableFilterDiv').html('');  
    $('#variableTableDiv').html('');
    $('#constraintFilterDiv').html(''); 
    $('#constraintTableDiv').html('');
    $('#outputTab').html('');
    $('#logContent').text(''); 
}

function clearData() {
    $('#dataTab').html('');
    fileId = new Array();
    fileCount = 0;
    ds = new Array();
}

function openModel() {
    if (modelEditor.isClean()) {
        filepicker.setKey('AIdU1Voz7RN686Gcu3kNEz');
        filepicker.pick({
                container: 'modal',
                services: ['COMPUTER','BOX','DROPBOX','GOOGLE_DRIVE','URL']
            },
            function(FPFile) {
                filepicker.read(FPFile, function(data) {
                    loadDescription('_blank.html');
                    modelEditor.setValue(data);
                    modelEditor.markClean();
                    $('#modelFileName').html(FPFile.filename);
                    clearOutput();
                })
            },
            function(FPError) {
                console.log(FPError.toString());
            }
        );
    } else {
        modalCallback = function () {
            modelEditor.markClean();
            openModel();
        }
        $('#modalConfirmClearAll').modal({show: true});
    }
}

function saveModel() {
    filepicker.setKey('AIdU1Voz7RN686Gcu3kNEz');
    filepicker.store(modelEditor.getValue(), {
            filename: 'tmp.mod',
            mimetype: 'text/plain',
            location: 'S3'
        },
        // If store is successful then export file
        function(FPFileS3) {
            filepicker.exportFile(FPFileS3, {
                mimetype: 'text/*',
                container: 'modal',
                services: ['COMPUTER','BOX','DROPBOX','GOOGLE_DRIVE'],
                suggestedFilename: $('#modelFileName').html()
            },
            // If export succeeds
            function(FPFile) {
                filepicker.remove(FPFileS3);
                $('#modelFileName').html(FPFile.filename);
                modelEditor.markClean();
            },
            // If export fails
            function(FPFile) {
                filepicker.remove(FPFileS3);
                console.log(FPError.toString());
            });
        },
        function(FPError) {
            console.log(FPError.toString());
        }
    );
}

// button Upload...
$('#files').on('change', function (evt) {
    var files = evt.target.files;
    var file = files[0];
    var reader = new FileReader();
    reader.onload = function(){
        modelEditor.setValue(this.result);
        $('#modelFileName').html(file.name);
    };
    reader.readAsText(file);
});

function createLink() {
    var link = homeURL + '?model=' + encodeURIComponent(modelEditor.getValue());
    $('#linkTextArea').val(link);
    $('#linkLength').html(link.length);
    $('#modalCreateLink').modal({show:true});
}

// button modal Confirm Clear All
$('#btnModalConfirmClearAll').click(function () {
    modalCallback();
});

// LP/LP+MIP radio buttons
function isMIP () {
     return $('#btnSolveMIP').is('.active') && (glp_get_num_int(lp) > 0);
}

/**********************************************************************
 MathProgError(message,arg)
 An error type used to catch attempts to read tables not in cache.
**********************************************************************/

function MathProgError(message,arg) {
    this.name = 'MathProgError';
    this.message = message || "MathProg Error";
    this.arg = arg || null;
    this.stack = (new Error()).stack;
}
MathProgError.prototype = new Error;

function tablecb(arg,mode,data) {
    switch(arg[1]) {
        case 'CSV':
            return tablecb_csv(arg,mode,data);
        case 'GCHART':
            return tablecb_chart(arg,mode,data);
        case 'JSON':
            return tablecb_json(arg,mode,data);
        default:
            throw new Error('Unrecognized table driver ' + arg[1]);
    }
};

function tablecb_chart(arg,mode,data) {
    switch(mode) {
        case 'R':
            throw new Error('Table GCHART is for OUT mode only.');

        case 'W':
            // display with Google Chart Tools. 
            //    arg[1]  "GCHART"
            //    arg[2]   Header
            //    arg[3]   chartType (optional; default is a Table)
            //    arg[4]   options

            // add new div container for the display
            $('<div><h4>' + arg[2]+ '</h4></div>')
                .appendTo('#outputTab')
                .css('padding-bottom','50px');

            // insert child div to hold chart
            var div = document.getElementById('outputTab').lastChild;
            div.appendChild(document.createElement('div'));

            google.load('visualization', '1',{"callback" : drawVisualization});
            function drawVisualization() {
                var tableData = google.visualization.arrayToDataTable(data);
                var chartType = (arg.length > 3)?arg[3]:'Table';
                var options = {
                    width: 750,

                    hAxis: {title: tableData.getColumnLabel(0)}
                }
                if (arg.length > 4) {
                    options = $.extend(options,eval('(' + arg[4] + ')'));
                }
                for (var j=0; j < tableData.getNumberOfColumns(); j++) {
                    if (tableData.getColumnType(j)=='number') {
                        for (var i=0; i < tableData.getNumberOfRows(); i++) {
                            tableData.setFormattedValue(i,j,formatNumber(tableData.getValue(i,j)));
                        }
                     }	            
                 }
                 var chart = new google.visualization.ChartWrapper({
                    chartType: chartType,
                    containerId: div.lastChild,
                    dataTable: tableData,
                    options: options
                });
                chart.draw();
            }
            return null;
         
        default : 
            throw new Error('Unrecognized table mode ' + mode);
    }
}

function tablecb_json(arg,mode,data) {
    switch(mode) {
        case 'R': 
         if (!fileId[arg[2]]) {
             throw new MathProgError('JSON file ' + arg[2] + ' not loaded',arg);
         } else {
             var data = ds[arg[2]];
             var arr = [];
             var line = [];
             for (var j = 0; j < data.getNumberOfColumns(); j++) {
                 line.push(data.getColumnLabel(j));
             }
             arr.push(line);
             for (var i = 0; i < data.getNumberOfRows(); i++) {
                 line = [];
                 for (var j = 0; j <  data.getNumberOfColumns(); j++) {
                     line.push(data.getValue(i,j));
                 }
                 arr.push(line);
             }
             return arr;
         }

        case 'W':
            // display with Google Chart Tools. 
            //    arg[1]  "JSON"
            //    arg[2]   Header
            //    arg[3]   chartType (optional; default is a Table)
            var chartType = (arg.length > 3)?arg[3]:'Table';

            // add new div container for the display
            $('<div></div>').appendTo('#outputTab').html('<h4>' + arg[2] + '</h4>').css('padding-bottom','30px');

            // insert child div to hold chart
            var div = document.getElementById('outputTab').lastChild;
            div.appendChild(document.createElement('div'));

            google.load('visualization', '1',{"callback" : drawVisualization});
            function drawVisualization() {
                var tableData = google.visualization.arrayToDataTable(data);
                for (var j=0; j < tableData.getNumberOfColumns(); j++) {
                    if (tableData.getColumnType(j)=='number') {
                        for (var i=0; i < tableData.getNumberOfRows(); i++) {
                            tableData.setFormattedValue(i,j,formatNumber(tableData.getValue(i,j)));
                        }
                     }	            
                 }
                 var chart = new google.visualization.ChartWrapper({
                    chartType: chartType,
                    containerId: div.lastChild,
                    dataTable: tableData,
                    options: {
                        width: 750,
                        hAxis: {title: tableData.getColumnLabel(0)}
                    }
                });
                chart.draw();
            }
            return null;
         
        default : 
            throw new MathProgError('Unrecognized table mode ' + mode);
    }
}

function tablecb_csv(arg,mode,data) {
    switch(mode) {
        case 'R':
            if (!fileId[arg[2]]) {
                // throw MathProgError if file isn't loaded into data cache
                throw new MathProgError('CSV file ' + arg[2] + ' not loaded',arg);
            } else {
                // read from data cache
                var dataId = 'MathProgFile_' + fileId[arg[2]].toString();
                return $('#'+dataId).html();
            }

        case 'W':
            // write to a new div element 
            document.getElementById('outputTab').appendChild(document.createElement('div'));
            var div = document.getElementById('outputTab').lastChild;
            $(div).html('<a><h4>' + arg[2] + '</h4></a>');
            $(div).click(function(){saveCSV(arg[2],data.toString())});
            div.style.paddingBottom = "20px";
            div.appendChild(document.createElement('pre'));
            var pre = div.lastChild;
            $(pre).append(data.toString());
            return null;

        default:
            throw new Error('Unrecognized table mode ' + mode);
    }
}

function saveCSV(filename,data) {
    filepicker.setKey('AIdU1Voz7RN686Gcu3kNEz');
    filepicker.store(data, {
            filename: 'tmp.mod',
            mimetype: 'text/plain',
            location: 'S3'
        },
        // If store is successful then export file
        function(FPFileS3) {
            filepicker.exportFile(FPFileS3, {
                mimetype: 'text/*',
                container: 'modal',
                services: ['COMPUTER','BOX','DROPBOX','GOOGLE_DRIVE'],
                suggestedFilename: filename
            },
            // If export succeeds
            function(FPFile) {
                filepicker.remove(FPFileS3);
            },
            // If export fails
            function(FPFile) {
                filepicker.remove(FPFileS3);
                console.log(FPError.toString());
            });
        },
        function(FPError) {
            console.log(FPError.toString());
        }
    );
}

/**********************************************************************
 print callback functions for glpk/MathProg
**********************************************************************/

// GLPK log output
function printLog(value){
    $('#logContent').append(value + '\n');
}

// print MathProg output from printf
function printOutput(value,filename){
    filename = filename || 'Terminal_Output';
    if (!fileId[filename]) {
        fileId[filename] = ++fileCount;
    }
    var OutputId = 'MathProgFile_' + fileId[filename].toString();
    if (document.getElementById(OutputId) == null) {
        $('<h4>'+filename+'</h4>').appendTo('#outputTab');
        $('<pre id = ' + OutputId + '></pre>').appendTo('#outputTab').css('padding-bottom','0.8em');
        $('<br>').appendTo('#outputTab');
    }
    $('#' + OutputId).append(value + '\n');
}

/**********************************************************************
 Generic Table Driver - Based on JSON Driver
**********************************************************************/

function xerror(message) {
    throw new Error(message);
}

function xassert(outcome,message) {
    if (!outcome) {
        throw new Error(message);
    }
    return 0;
}

function GenericDriver(dca, mode, tablecb){
    this.mode = mode;
    this.fname = null;
    this.fname = mpl_tab_get_arg(dca, 2);
    var k;
    if (mode == 'R') {
        this.ref = {};
        if (tablecb){
            this.data = tablecb(dca.arg, mode);
            if (typeof this.data == 'string')
                this.data = JSON.parse(this.data);
            this.cursor = 1;
        } else
            xerror("json driver: unable to open " + this.fname);

        for (var i = 0, meta = this.data[0]; i < meta.length; i++)
            this.ref[meta[i]] = i;
    } else if (mode == 'W') {
        this.tablecb = tablecb;
        var names = [];
        this.data = [names];
        var nf = mpl_tab_num_flds(dca);
        for (k = 1; k <= nf; k++) {
            names.push(mpl_tab_get_name(dca, k));
        }
    } else {
        xassert(mode != mode);
    }
}

GenericDriver.prototype["writeRecord"] = function(dca){
    var k;
    xassert(this.mode == 'W');
    var nf = mpl_tab_num_flds(dca);
    var line = [];
    for (k = 1; k <= nf; k++){
        switch (mpl_tab_get_type(dca, k)){
            case 'N':
                line.push(mpl_tab_get_num(dca, k));
                break;
            case 'S':
                line.push(mpl_tab_get_str(dca, k));
                break;
            default:
                xassert(dca != dca);
        }
    }
    this.data.push(line);
    return 0;
};

GenericDriver.prototype["readRecord"] = function(dca){
    /* read next record */
    var ret = 0;
    xassert(this.mode == 'R');

    /* read fields */
    var line = this.data[this.cursor++];
    if (line == null) return XEOF;

    for (var k = 1; k <= mpl_tab_num_flds(dca); k++){
        var index = this.ref[mpl_tab_get_name(dca, k)];
        if (index != null){
            var value = line[index];
            switch (typeof value){
                case 'number':
                    mpl_tab_set_num(dca, k, value);
                    break;
                case 'boolean':
                    mpl_tab_set_num(dca, k, Number(value));
                    break;
                case 'string':
                    mpl_tab_set_str(dca, k, value);
                    break;
                default:
                    xerror('Unexpected data type ' + value + " in " + this.fname);
            }
        }
    }
    return 0;
};

GenericDriver.prototype["flush"] = function(dca){
   // this.tablecb(dca.arg, this.mode, this.data);  <== why doesn't this work?
   // this.tablecb(dca.a, this.mode, this.data);
   var args = mpl_tab_get_args(dca);
   this.tablecb(args, this.mode, this.data);
};

mpl_tab_drv_register("GCHART", GenericDriver);
mpl_tab_drv_register("MY", GenericDriver);

/**********************************************************************
 Data Cache
**********************************************************************/

function loadCSV(filename) {
    var jqxhr = $.get(filename, function(data) {
        if (!fileId[filename]) {
            fileId[filename] = ++fileCount;
        }
        var dataId = 'MathProgFile_' + fileId[filename].toString();
        if (document.getElementById(dataId) == null) {
            $('<h4>' + filename + '</h4>').appendTo('#dataTab');
            $('<pre id=' + dataId + '></pre>')
                .appendTo('#dataTab')
                .css('padding-bottom','0.8em');
            $('<br>').appendTo('#dataTab');
        }
        $('#' + dataId).html(data);
    });
    return jqxhr;
}

function loadJSON(arg,callback) {
    var filename = arg[2];
    var key = arg[3];
    if (!fileId[filename]) {
        fileId[filename] = ++fileCount;
    }
    var dataId = 'MathProgFile_' + fileId[filename].toString();
    function drawVisualization() {
        var query = new google.visualization.Query(
            'https://docs.google.com/spreadsheet/tq?key=' + key + '&gid=0&headers=-1');
        query.send(handleQueryResponse);
    }
    function handleQueryResponse(response) {
        if (response.isError()) {
            throw new Error(response.getMessage() + ' ' + response.getDetailMessage());
        } else {
            if (document.getElementById(dataId) == null) {
                $('<h4>' + filename + '</h4>').appendTo('#dataTab');
                $('<div id=' + dataId + '></div>').appendTo('#dataTab').css('padding-bottom','2em');
            }
            var data = response.getDataTable();
            var table = new google.visualization.Table(document.getElementById(dataId));
            table.draw(data,null);
            ds[filename] = data;
            callback();
        }
    }
    google.load('visualization', '1',{packages:['table'],"callback" : drawVisualization});
}

/**********************************************************************
 Solver
**********************************************************************/

function solve() {
    try {
        solveModel();
    } catch (err) {
        if (err instanceof MathProgError) {
            // trap table reading errors
            if (err.arg !== null) {
                var arg = err.arg;
                switch (arg[1]) {
                    case 'CSV':
                        if (arg[3]==null) {
                            var jqxhr = loadCSV(arg[2]);
                            jqxhr.done(solve);
                            jqxhr.fail(function(jqxhr, textStatus, errorThrown) {
                                displayError('Table error: ' + arg[2] + ' ' + errorThrown);
                            });

                        } else {
                            displayError('Unrecognized option for the CSV table driver.');
                        }
                        break;
                    case 'JSON':
                        loadJSON(arg,solve);
                        break;
                    default:
                }
            } else {
                displayError(err.message);
            }
        } else {
            displayError(err.message);
        }
        return null;
    }
};

function solveModel() {
    tic = Date.now();
    clearOutput();
    clearMessage();

    printLog('Reading ...');
    var tran = glp_mpl_alloc_wksp();
    try {
        glp_mpl_read_model_from_string(tran,'MathProg Model',modelEditor.getValue());
    } catch (err) {
        displayError(err.message);
        modelEditor.setCursor(err.line,0);
        modelEditor.scrollIntoView(null);
        return null;
    }

    printLog('\nGenerating ...');
    glp_mpl_generate(tran,null,printOutput,tablecb);

    printLog('\nBuilding ...');
    glp_mpl_build_prob(tran,lp);

    printLog('\nSolving ...');
    var smcp = new SMCP({presolve: GLP_ON});
    glp_simplex(lp, smcp);

    if (isMIP()) {
        printLog('\nInteger optimization ...')
        glp_intopt(lp);
    }

    printLog('\nPost-Processing ...');
    if(lp) {
	    if (glp_get_status(lp)==GLP_OPT) {
            if (!isMIP() && (glp_get_num_int(lp) > 0)) {
               displayWarning('Linear relaxation of an MIP.');
            } else {
               displaySuccess(glpStatus[glp_get_status(lp)]);
            }
        } else {
            displayWarning(glpStatus[glp_get_status(lp) + glp_get_status(lp) + GLP_OPT]);
        }
        glp_mpl_postsolve(tran,lp,isMIP()?GLP_MIP:GLP_SOL);
        displayDashboard();
        google.load('visualization', '1.0', { packages:['controls'], callback: writeVariableTable});
        google.load('visualization', '1.0', { packages:['controls'], callback: writeConstraintTable});
     } else {
        throw new MathProgError((isMIP()?'MILP':'LP') + " failed. Consult GLPK Log.");
     }

     printLog('\nElapsed time: ' + (Date.now()-tic)/1000 + ' seconds');
     return null;
}
