document.addEventListener('DOMContentLoaded', () => {
  const graphs = [];
  let currentIndex = 0;


  const csvUrl = 'fight-songs-updated.csv';
  const palette = ['#d62828', '#f6c90e', '#1f4fd8', '#90caf9', '#ffea94', '#ff8b8b', '#7bf677', '#3d3a3a', "#169e1b"];


  Papa.parse(csvUrl, {
    download: true,
    header: true,
    dynamicTyping: true,
    complete: function(results) {
      const data = results.data.filter(d => d.school);
      const schools = data.map(d => d.school);
      const tropes = ['fight','victory','win_won','rah','nonsense','colors','men','opponents','spelling'];


      const tropeCounts = data.map(d => tropes.reduce((sum,tr) => sum + (d[tr]==='Yes'?1:0), 0));


      // Average trope count by conference
      const confMap = {};
      data.forEach(d => {
        const conf = d.conference || 'Unknown';
        if(!confMap[conf]) confMap[conf] = [];
        confMap[conf].push(tropes.reduce((sum,tr) => sum + (d[tr]==='Yes'?1:0),0));
      });
      const confAvg = Object.entries(confMap).map(([c,arr]) => ({
        conference: c,
        avg: arr.reduce((a,b)=>a+b,0)/arr.length
      }));


      // --- Graphs ---
      graphs.push(
        {
          type: 'scatter',
          values: data,
          title: 'Tempo vs. Duration',
          caption: 'The distribution for the duration of fight songs has a bimodal appearance, with most songs clustered around centers of approximately 75 BPM and 150 BPM. BPM does not appear to have a strong correlation with duration: songs with a higher BPM (i.e. a quicker tempo) still largely fall into the common range of a duration between approximately 20 seconds and 120 seconds. Texas A&M, with a song duration of 172 seconds, is a noticeable outlier. They do say that everything is bigger in Texas!'
        },
        {
          type: 'durationByConference',
          values: data,
          title: 'Song Duration by Conference',
          caption: 'The Big Ten has the highest median song duration and the widest overall spread. The ACC and Pac-12 fall in the middle, with moderate medians and some outliers. The Big 12 and SEC tend to have shorter median durations, though the SEC includes a notable long-duration outlier that increases its overall range. The Independent category does not have enough data to be fully comparable. A substantial amount of overlap between these boxes means that we cannot claim that one conference has meaningfully longer songs than others, but the trends do suggest that the Big Ten tends towards longer songs, and the Big 12 and SEC towards shorter ones.'
        },
        {
          type: 'stacked',
          values: data,
          title: 'Stacked Tropes by School',
          tropes: tropes,
          schools: schools
        },
        {
          type: 'bar',
          values: confAvg.map(c => c.avg),
          labels: confAvg.map(c => c.conference),
          title: 'Average Trope Count by Conference'
        },
        {
          type: 'chord',
          values: data,
          tropes: tropes,
          title: 'Trope Relationships Chord Chart'
        }
      );


      showGraph(currentIndex);
    },


  });


  function showGraph(index) {
    const g = graphs[index];
    const container = document.getElementById('graph-container');
    container.innerHTML = '';


    if (g.type === 'scatter') {
  const xVals = g.values.map(d => d.bpm);
  const yVals = g.values.map(d => d.sec_duration);
  const hoverTexts = g.values.map(d => d.school);


  const traces = [{
    x: xVals,
    y: yVals,
    text: Array(xVals.length).fill('♪'),
    mode: 'text',
    textfont: {
      size: 20,
      color: '#1f4fd8',
      family: 'Archivo Black, sans-serif'
    },
    hovertext: hoverTexts,
    hoverinfo: 'text'
  }];


  Plotly.newPlot(container, traces, {
    title: { text: g.title, font: { size: 22, family: 'Oswald, sans-serif' } },
    xaxis: { title: 'BPM', range: [0, Math.max(...xVals) + 10], },
    yaxis: { title: 'Duration (s)', range: [0, Math.max(...yVals) + 10], }
  });
}


else if (g.type === 'durationByConference') {
  const allDurations = g.values.map(d => d.sec_duration);
  const yMax = Math.max(...allDurations);
  const conferences = [...new Set(g.values.map(d => d.conference || 'Unknown'))];


  const traces = conferences.map((conf, i) => {
    const durations = g.values
      .filter(d => (d.conference || 'Unknown') === conf)
      .map(d => d.sec_duration);


    return {
      y: durations,
      type: 'box',
      name: conf,
      marker: { color: palette[i % palette.length] },
      boxpoints: 'all',
      jitter: 0.5,
      pointpos: 0
    };
  });


  Plotly.newPlot(container, traces, {
    title: { text: g.title, font: { size: 22, family: 'Oswald, sans-serif' } },
    yaxis: { title: 'Duration (seconds)', range: [0, yMax + 10], },
    xaxis: { title: 'Conference' },
    showlegend: false
  });
}
    else if (g.type === 'stacked') {
      const traceData = g.tropes.map((tr,i) => ({
        x: g.schools,
        y: g.values.map(d => d[tr]==='Yes'?1:0),
        name: tr,
        type: 'bar',
        marker: { color: palette[i % palette.length] }
      }));


      Plotly.newPlot(container, traceData, {
        barmode: 'stack',
        title: { text: g.title, font: { size: 22, family: 'Oswald, sans-serif' } },
        xaxis: { tickangle: -45 }
      });
    }


    // --- Bar chart ---
    else if (g.type === 'bar') {
      Plotly.newPlot(container, [{
        x: g.labels,
        y: g.values,
        type: 'bar',
        marker: { color: palette }
      }], {
        title: { text: g.title, font: { size: 22, family: 'Oswald, sans-serif' } },
        xaxis: { tickangle: -45 }
      });
    }


    // --- Chord chart ---
    else if (g.type === 'chord') {
      const width = container.clientWidth;
      const height = container.clientHeight;
      const svg = d3.select(container).append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${width/2},${height/2})`);


      const n = g.tropes.length;
      const matrix = Array.from({length:n},()=>Array(n).fill(0));
      g.values.forEach(d=>{
        g.tropes.forEach((t1,i)=>{
          g.tropes.forEach((t2,j)=>{
            if(d[t1]==='Yes' && d[t2]==='Yes') matrix[i][j]++;
          });
        });
      });


      const chord = d3.chord().padAngle(0.05).sortSubgroups(d3.descending)(matrix);
      const arc = d3.arc().innerRadius(180).outerRadius(200);
      const ribbon = d3.ribbon().radius(180);
      const colorScale = d3.scaleOrdinal().domain(d3.range(n)).range(palette);


      // arcs
      svg.append('g')
        .selectAll('g')
        .data(chord.groups)
        .join('g')
        .append('path')
        .attr('fill', d=>colorScale(d.index))
        .attr('stroke','#000')
        .attr('d',arc);


      // ribbons
      svg.append('g')
        .selectAll('path')
        .data(chord)
        .join('path')
        .attr('d', ribbon)
        .attr('fill', d=>colorScale(d.target.index))
        .attr('stroke','#000');


      // labels
      svg.append('g')
        .selectAll('text')
        .data(chord.groups)
        .join('text')
        .each(d => { d.angle=(d.startAngle+d.endAngle)/2; })
        .attr('dy','.35em')
        .attr('transform', d=>`
          rotate(${d.angle*180/Math.PI - 90})
          translate(${210},0)
          ${d.angle>Math.PI?'rotate(180)':''}
        `)
        .attr('text-anchor', d=>d.angle>Math.PI?'end':'start')
        .text(d=>g.tropes[d.index]);
    }
  }


  document.getElementById('next-graph').addEventListener('click', ()=>{
    currentIndex = (currentIndex + 1) % graphs.length;
    showGraph(currentIndex);
  });


  document.getElementById('prev-graph').addEventListener('click', ()=>{
    currentIndex = (currentIndex - 1 + graphs.length) % graphs.length;
    showGraph(currentIndex);
  });
});
