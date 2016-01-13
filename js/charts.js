var resetTabCharts 
var _data = {};
var original_data
var _council_bounds = {};
var _region_bounds = {};
var _auth_dict = {};
var _region_dict = {};
var _title_text = {};
var small_chart_height = 150;

var donut_inner = 30
var donut_outer = 70

var valueAccessor =function(d){return d.value < 1 ? 0 : d.value}
var quarters = {MAR:1, JUN:2, SEP:3, DEC:4}
var age_charts;

var getkeys;
//---------------------CLEANUP functions-------------------------

function cleanup(d) {

 
  d.year = +d.Quarter.substr(3,2)+2000
  d.qtr = d.Quarter.substr(0,3)
  d.sexAge = d.Gender + ', '+ d.Age_Group
  d.Count = +d.Count
  
  return d;
}


//---------------------------crossfilter reduce functions---------------------------

// we only use the built in reduceSum(<what we are summing>) here

//----------------------------Accessor functions-------------------------------------

// because we are only using default reduce functions, we don't need any accessor functions either 

//-------------------------Load data and dictionaries ------------------------------

//Here queue makes sure we have all the data from all the sources loaded before we try and do anything with it. It also means we don't need to nest D3 file reading loops, which could be annoying. 

queue()
    .defer(d3.csv,  "data/all-main-benefits-september-2015.csv")
   // .defer(d3.csv,  "dictionaries/NMS_authority_dict.csv")
    .defer(d3.csv,  "dictionaries/titles.csv")
    .await(showCharts);

function showCharts(err, data, title_text) {

//We use dictionary .csv's to store things we might want to map our data to, such as codes to names, names to abbreviations etc.
  
//titles.csv is a special case of this, allowing for the mapping of text for legends and titles on to the same HTML anchors as the charts. This allows clients to update their own legends and titles by editing the csv rather than monkeying around in the .html or paying us to monkey around with the same.    
  
  var councilNames = [];
  
  for (i in title_text){
        entry = title_text[i]
        //trimAll(entry)
        name = entry.id
        _title_text[name]=entry;     
  }
  
//  for (i in auth_dict) {
//    entry = auth_dict[i]
//    trimAll(entry)
//    name = entry.Name
//    councilNames.push(name);
//    _auth_dict[entry.Name]=entry;
//  } 


  for (i in data) {
    data[i] = cleanup(data[i]);
  }
  _data = data;

 
//------------Puts legends and titles on the chart divs and the entire page---------------   
  apply_text(_title_text)

//---------------------------------FILTERS-----------------------------------------
  ndx = crossfilter(_data); // YAY CROSSFILTER! Unless things get really complicated, this is the only bit where we call crossfilter directly. 

//--------------------------Reduce functions, valueaccessors---------------------------------------  
  
//reduceBenefit = {
//  add:function(v,d){ 
//    v[d.Benefit_Group] += d.Count 
//    return v
//  },
//  remove: function(v,d){
//    v[d.Benefit_Group] -= d.Count 
//    return v
//  },
//  init: function(){return {
//    "Jobseeker Support" :0, 
//    "Other Main Benefit":0, 
//    "Sole Parent Support" :0, 
//    "Supported Living" :0, 
//    "Youth Payment and Young Parent Payment" :0 
//    } 
//  }
//}  

function configureableReduce(field, value, init) {
  return {
    add: function(v,d){ 
      v[d[field]] = (v[d[field]] || 0) + d[value];
      return v
    },
    remove: function(v,d){
      v[d[field]] -= d[value];
      return v
    },
    init: function() {
      return init ? JSON.parse(JSON.stringify(init)) : {}
    }
  }
}

reduceBenefit2 = configureableReduce('Benefit_Group', 'Count', {
    "Jobseeker Support" :0, 
    "Other Main Benefit":0, 
    "Sole Parent Support" :0, 
    "Supported Living" :0, 
    "Youth Payment and Young Parent Payment" :0 
    }
  )

reduce_ethnicity = configureableReduce('Ethnicity', 'Count', {
  "Ethnicity suppressed":0, 
  "Maori":0, 
  "NZ European":0, 
  "Other":0, 
  "Pacific Island":0, 
  "Unspecified":0
  }
)

reduce_duration = configureableReduce('Continuous_duration', 'Count', {
  "More than 1 year":0, 
  "1 year or less":0, 
  }                                      
)

reduce_age = configureableReduce('Age_Group', 'Count')
  

sumAccessor = function(d){return _.reduce(_.values(d.value), function(memo, num){ return memo + num; }, 0)}

//---------------------------ORDINARY CHARTS --------------------------------------
  year = ndx.dimension(function(d){return d.year +"q" +quarters[d.qtr]});
  year_group_benefit = year.group().reduce(reduceBenefit2.add,reduceBenefit2.remove,reduceBenefit2.init);
  year_group_ethnicity = year.group().reduce(reduce_ethnicity.add, reduce_ethnicity.remove,reduce_ethnicity.init);
  year_group_duration = year.group().reduce(reduce_duration.add, reduce_duration.remove,reduce_duration.init)
  year_group_age = year.group().reduce(reduce_age.add, reduce_age.remove,reduce_age.init)
  
 
  
  year_chart = dc.barChart('#year')
    .dimension(year)
    .group(year_group_benefit)
    .valueAccessor(sumAccessor)
    .x(d3.scale.ordinal())
    .xUnits(dc.units.ordinal)
    .transitionDuration(200)
    .height(small_chart_height/1.5)
    .colors(default_blues)
    .elasticX(false)
    .elasticY(true)
    .centerBar(false)
    .brushOn(false); 
  
  year_chart.on('postRender.year', function(chart){
      chart.filter("2015q3")
      dc.redrawAll();
      chart.selectAll('rect.bar').on('click.singleFiler', function(d,i){
        year_chart.filterAll();
        year_chart.filter(d.data.key);
        dc.redrawAll();
      })  
  })
  
  
  //year_chart.xAxis().tickFormat(function(d){console.log(d);return "tick"});
  year_chart.yAxis().ticks(2).tickFormat(integer_format)

  
  year_benefit_chart = dc.lineChart('#year_benefit')
    .dimension(year)
    .group(year_group_benefit,"Jobseeker Support")
    .valueAccessor(function(d){return d.value["Jobseeker Support"]})
    .stack(year_group_benefit,"Sole Parent Support" ,function(d){return d.value["Sole Parent Support" ]})
    .stack(year_group_benefit,"Supported Living" ,function(d){return d.value["Supported Living" ]})
    .stack(year_group_benefit,"Other Main Benefit",function(d){return d.value["Other Main Benefit"]})
    .stack(year_group_benefit,"Youth Payment and Young Parent Payment",function(d){return d.value["Youth Payment and Young Parent Payment"]})
    .x(d3.scale.ordinal())
    .xUnits(dc.units.ordinal)
    .transitionDuration(200)
    .height(small_chart_height+32)
    .colors(default_blues)
    .elasticX(false)
    .elasticY(true)
    .renderArea(true)
    .brushOn(false)
    .legend(dc.legend().x(60).y(small_chart_height-20).autoItemWidth(true).gap(20).horizontal(true))
  
   year_benefit_chart.yAxis().ticks(4).tickFormat(integer_format)

  year_ethnicity_chart = dc.lineChart('#year_ethnicity')
    .dimension(year)
    .group(year_group_ethnicity,"Maori")
    .valueAccessor(function(d){return d.value["Maori"]})
    .stack(year_group_ethnicity,"NZ European",function(d){return d.value["NZ European"]})
    .stack(year_group_ethnicity,"Other",function(d){return d.value["Other"]})
    .stack(year_group_ethnicity,"Pacific Island",function(d){return d.value["Pacific Island"]})
    .stack(year_group_ethnicity,"Unspecified",function(d){return d.value["Unspecified"]})
    .stack(year_group_ethnicity,"Ethnicity suppressed",function(d){return d.value["Ethnicity suppressed"]})
    .x(d3.scale.ordinal())
    .xUnits(dc.units.ordinal)
    .transitionDuration(200)
    .height(small_chart_height+32)
    .colors(default_blues)
    .elasticX(false)
    .elasticY(true)
    .renderArea(true)
    .brushOn(false)
    .legend(dc.legend().x(60).y(small_chart_height-20).autoItemWidth(true).gap(25).horizontal(true))
  
   year_ethnicity_chart.yAxis().ticks(4).tickFormat(integer_format)
  
  year_duration_chart = dc.lineChart('#year_duration')
    .dimension(year)
    .group(year_group_duration,"More than 1 year")
    .valueAccessor(function(d){return d.value["More than 1 year"]})
    .stack(year_group_duration,"1 year or less",function(d){return d.value["1 year or less"]})
    .x(d3.scale.ordinal())
    .xUnits(dc.units.ordinal)
    .transitionDuration(200)
    .height(small_chart_height+32)
    .colors(default_reds)
    .elasticX(false)
    .elasticY(true)
    .renderArea(true)
    .brushOn(false)
    .legend(dc.legend().x(60).y(small_chart_height-20).autoItemWidth(true).gap(25).horizontal(true))
  
   year_duration_chart.yAxis().ticks(4).tickFormat(integer_format)
   
   year_age_chart = dc.lineChart('#year_agegroup')
    .dimension(year)
    .group(year_group_age,"18-24 years")
    .valueAccessor(function(d){return d.value["18-24"]})
    .stack(year_group_age,"25-39 years",function(d){return d.value["25-39"]})
    .stack(year_group_age,"40-54 years",function(d){return d.value["40-54"]})
    .stack(year_group_age,"55-64 years",function(d){return d.value["55-64"]})
    .x(d3.scale.ordinal())
    .xUnits(dc.units.ordinal)
    .transitionDuration(200)
    .height(small_chart_height+32)
    .colors(default_reds)
    .elasticX(false)
    .elasticY(true)
    .renderArea(true)
    .brushOn(false)
    .legend(dc.legend().x(60).y(small_chart_height-20).autoItemWidth(true).gap(25).horizontal(true))
  
   year_age_chart.yAxis().ticks(4).tickFormat(integer_format)
  
  age = ndx.dimension(function(d) {return d.sexAge});
  age_group = age.group().reduceSum(function(d){return d.Count})
   
//
  age_chart = dc.pyramidChart('#tree')
    .dimension(age)
    .group(age_group)
    .valueAccessor(valueAccessor)
    .colors(d3.scale.ordinal().range([our_reds[0],our_blues[1]]))
    .colorAccessor(function(d){return d.key[0]})
    .leftColumn(function(d){return d.key[0] == 'M'}) // return true if entry is to go in the left column. Defaults to i%2 == 0, i.e. every second one goes to the right.
   .rowAccessor(function(d){return +d.key.split(' ')[1].split('-')[0]}) // return the row the group needs to go into.
    .height(small_chart_height)
    //.title(function(d,i){return i})
    .label(function(d){return d.key.split(' ')[1]})
    .elasticX(true)
    //.labelOffsetX(20)
    .twoLabels(false)// defaults to true. if false, .label defaults to .rowAccessor
    .columnLabels(['Male','Female'])
    .columnLabelPosition([0,105]) //[in,down], in pix. defaults to [5,10]
    .transitionDuration(200)
  
    age_chart.xAxis().ticks(7).tickFormat(function(x) {return d3.format('s')(Math.abs(x))})
    
  benefit = ndx.dimension(function(d){return d.Benefit_Group});
  benefit_group = benefit.group().reduceSum(function(d){return d.Count});
 
  benefit_chart = dc.rowChart('#benefit')
    .dimension(benefit)
    .group(benefit_group)
    .valueAccessor(valueAccessor)
    .transitionDuration(200)
    .height(small_chart_height)
    .colors(default_blues)
    .elasticX('true')
    .ordering(function(d){return -d.value})
    
  
  benefit_chart.xAxis().ticks(4).tickFormat(integer_format)
  
  ethnicity = ndx.dimension(function(d){return d.Ethnicity});
  ethnicity_group = ethnicity.group().reduceSum(function(d){return d.Count});
 
  ethnicity_chart = dc.rowChart('#ethnicity')
    .dimension(ethnicity)
    .group(ethnicity_group)
    .valueAccessor(valueAccessor)
    .transitionDuration(200)
    .height(small_chart_height)
    .colors(default_blues)
    .elasticX('true')
    .ordering(function(d){return -d.value})
  
  ethnicity_chart.xAxis().ticks(4).tickFormat(integer_format)
      
   duration = ndx.dimension(function(d){return d.Continuous_duration});
  duration_group = duration.group().reduceSum(function(d){return d.Count});
 
  duration_chart = dc.pieChart('#duration')
    .dimension(duration)
    .group(duration_group)
    .valueAccessor(valueAccessor)
    .transitionDuration(200)
    .height(small_chart_height)
   //.innerRadius(donut_inner)
    .radius(donut_outer)
    .colors(default_reds)

  
  dc.renderAll()

}
